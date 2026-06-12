import type Database from 'better-sqlite3';
import { createHash } from 'node:crypto';
import { getDb } from './db';

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
};

export function requestIdentifier(req: Request) {
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const realIp = req.headers.get('x-real-ip')?.trim();
  const source = forwarded || realIp || 'unknown';
  return createHash('sha256').update(source).digest('hex');
}

export function consumeRateLimit(
  scope: string,
  identifier: string,
  limit: number,
  windowSeconds: number,
  db: Database.Database = getDb()
): RateLimitResult {
  const now = Math.floor(Date.now() / 1000);
  const windowStart = Math.floor(now / windowSeconds) * windowSeconds;
  const count = db.transaction(() => {
    db.prepare(
      `INSERT INTO rate_limits (scope, identifier, window_start, request_count) VALUES (?, ?, ?, 1)
       ON CONFLICT(scope, identifier, window_start)
       DO UPDATE SET request_count = request_count + 1`
    ).run(scope, identifier, windowStart);
    return (db.prepare(
      'SELECT request_count FROM rate_limits WHERE scope = ? AND identifier = ? AND window_start = ?'
    ).get(scope, identifier, windowStart) as { request_count: number }).request_count;
  })();
  if (Math.random() < 0.01) {
    db.prepare('DELETE FROM rate_limits WHERE window_start < ?').run(windowStart - windowSeconds * 2);
  }
  return {
    allowed: count <= limit,
    limit,
    remaining: Math.max(0, limit - count),
    retryAfterSeconds: Math.max(1, windowStart + windowSeconds - now),
  };
}

export function rateLimitHeaders(result: RateLimitResult) {
  return {
    'RateLimit-Limit': String(result.limit),
    'RateLimit-Remaining': String(result.remaining),
    'Retry-After': String(result.retryAfterSeconds),
  };
}
