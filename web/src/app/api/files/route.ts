import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSessionAddress } from '@/lib/auth';
import { randomUUID } from 'node:crypto';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const address = await getSessionAddress();
  if (!address) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const {
    title,
    cid,
    fileName,
    mime,
    sizeBytes,
    iv,
    salt,
    ivWrap,
    wrappedKey,
    rawKeyBase64,
  } = body as {
    title?: string;
    cid: string;
    fileName?: string;
    mime?: string;
    sizeBytes?: number;
    iv: string; // base64
    salt?: string; // base64
    ivWrap?: string; // base64
    wrappedKey?: string; // base64
    rawKeyBase64?: string; // base64
  };

  if (!cid || !iv) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

  const db = getDb();
  const fileId = randomUUID();
  const stmt = db.prepare(
    `INSERT INTO files (id, owner_address, title, cid, name, mime, size_bytes, iv, salt, iv_wrap, wrapped_key, raw_key_base64)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  stmt.run(
    fileId,
    address,
    title ?? null,
    cid,
    fileName ?? null,
    mime ?? null,
    sizeBytes ?? null,
    Buffer.from(iv, 'base64'),
    salt ? Buffer.from(salt, 'base64') : null,
    ivWrap ? Buffer.from(ivWrap, 'base64') : null,
    wrappedKey ? Buffer.from(wrappedKey, 'base64') : null,
    rawKeyBase64 ?? null
  );

  // Issue token with default TTL: 24h
  const token = randomUUID();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  db.prepare(
    `INSERT INTO tokens (token, file_id, issued_to_address, expires_at, revoked)
     VALUES (?, ?, ?, ?, 0)`
  ).run(token, fileId, null, expiresAt);

  return NextResponse.json({ fileId, token });
}
