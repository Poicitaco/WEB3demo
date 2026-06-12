import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { setNonceCookie } from '@/lib/auth';
import { consumeRateLimit, rateLimitHeaders, requestIdentifier } from '@/lib/rateLimit';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const rateLimit = consumeRateLimit('auth:start', requestIdentifier(req), 30, 60);
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: 'Too many login attempts' }, { status: 429, headers: rateLimitHeaders(rateLimit) });
  }
  const nonce = randomUUID();
  await setNonceCookie(nonce);
  return NextResponse.json({ nonce, message: `Sign this nonce to login: ${nonce}` }, { headers: rateLimitHeaders(rateLimit) });
}
