import { NextResponse } from 'next/server';
import { getSessionAddress } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { randomUUID } from 'node:crypto';
import { verifyCsrf } from '@/lib/csrf';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const address = await getSessionAddress();
  if (!address) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await verifyCsrf(req))) return NextResponse.json({ error: 'CSRF' }, { status: 403 });
  const { fileId, ttlMinutes, issuedTo } = (await req.json().catch(() => ({}))) as {
    fileId?: string;
    ttlMinutes?: number;
    issuedTo?: string | null;
  };
  if (!fileId) return NextResponse.json({ error: 'Missing fileId' }, { status: 400 });
  const db = getDb();
  const file = db.prepare('SELECT id FROM files WHERE id = ? AND owner_address = ?').get(fileId, address) as { id: string } | undefined;
  if (!file) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const token = randomUUID();
  const ttl = (typeof ttlMinutes === 'number' && ttlMinutes > 0 ? ttlMinutes : 24 * 60) * 60 * 1000;
  const expiresAt = new Date(Date.now() + ttl).toISOString();
  db.prepare('INSERT INTO tokens (token, file_id, issued_to_address, expires_at, revoked) VALUES (?, ?, ?, ?, 0)')
    .run(token, fileId, issuedTo ?? null, expiresAt);
  return NextResponse.json({ ok: true, token, expiresAt });
}

