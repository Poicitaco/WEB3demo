import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSessionAddress } from '@/lib/auth';
import { randomUUID } from 'node:crypto';
import { verifyCsrf } from '@/lib/csrf';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const address = await getSessionAddress();
  if (!address) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await verifyCsrf(req))) return NextResponse.json({ error: 'CSRF' }, { status: 403 });

  const body = await req.json();
  const {
    title,
    description,
    cid,
    fileName,
    mime,
    sizeBytes,
    iv,
    salt,
    ivWrap,
    wrappedKey,
    rawKeyBase64,
    ttlMinutes,
  } = body as {
    title?: string;
    description?: string;
    cid: string;
    fileName?: string;
    mime?: string;
    sizeBytes?: number;
    iv: string; // base64
    salt?: string; // base64
    ivWrap?: string; // base64
    wrappedKey?: string; // base64
    rawKeyBase64?: string; // base64
    ttlMinutes?: number;
  };
  // Basic input validation
  if (!cid || !iv) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  const titleTrim = (title ?? '').trim();
  if (titleTrim.length > 200) return NextResponse.json({ error: 'Title too long' }, { status: 400 });
  if (fileName && fileName.length > 255) return NextResponse.json({ error: 'File name too long' }, { status: 400 });
  if (typeof sizeBytes === 'number' && sizeBytes > 50 * 1024 * 1024) {
    return NextResponse.json({ error: 'File too large' }, { status: 413 });
  }
  function b64ToBuf(b?: string) {
    if (!b) return null;
    try {
      return Buffer.from(b, 'base64');
    } catch {
      return null;
    }
  }
  const ivBuf = b64ToBuf(iv);
  if (!ivBuf || ivBuf.length !== 12) return NextResponse.json({ error: 'Invalid IV' }, { status: 400 });
  const saltBuf = b64ToBuf(salt);
  if (salt && (!saltBuf || saltBuf.length !== 16)) return NextResponse.json({ error: 'Invalid salt' }, { status: 400 });
  const ivWrapBuf = b64ToBuf(ivWrap);
  if (ivWrap && (!ivWrapBuf || ivWrapBuf.length !== 12)) return NextResponse.json({ error: 'Invalid IV wrap' }, { status: 400 });
  const wrappedKeyBuf = b64ToBuf(wrappedKey);
  const rawKeyBuf = b64ToBuf(rawKeyBase64);

  const allowRaw = process.env.ALLOW_RAW_KEYS === 'true' || process.env.NODE_ENV !== 'production';
  const hasWrapped = Boolean(saltBuf && ivWrapBuf && wrappedKeyBuf);
  const hasRaw = Boolean(rawKeyBuf);
  if (!hasWrapped && !hasRaw) return NextResponse.json({ error: 'Missing key material' }, { status: 400 });
  if (hasRaw && !allowRaw) return NextResponse.json({ error: 'Raw key not allowed' }, { status: 400 });

  const db = getDb();
  const fileId = randomUUID();
  const stmt = db.prepare(
    `INSERT INTO files (id, owner_address, title, description, cid, name, mime, size_bytes, iv, salt, iv_wrap, wrapped_key, raw_key_base64)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  stmt.run(
    fileId,
    address,
    titleTrim || null,
    description ?? null,
    cid,
    fileName ?? null,
    mime ?? null,
    sizeBytes ?? null,
    ivBuf,
    saltBuf,
    ivWrapBuf,
    wrappedKeyBuf,
    rawKeyBase64 ?? null
  );

  // Issue token with default TTL: 24h
  const token = randomUUID();
  const ttlMs = (typeof ttlMinutes === 'number' && ttlMinutes > 0 ? ttlMinutes : 24 * 60) * 60 * 1000;
  const expiresAt = new Date(Date.now() + ttlMs).toISOString();
  db.prepare(
    `INSERT INTO tokens (token, file_id, issued_to_address, expires_at, revoked)
     VALUES (?, ?, ?, ?, 0)`
  ).run(token, fileId, null, expiresAt);

  return NextResponse.json({ fileId, token });
}
