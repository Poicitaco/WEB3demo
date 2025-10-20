import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const { token } = (await req.json().catch(() => ({}))) as { token?: string };
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 });
  const db = getDb();
  type Row = {
    token: string;
    file_id: string;
    expires_at: string | null;
    revoked: number;
    cid: string;
    iv: Buffer;
    salt?: Buffer | null;
    iv_wrap?: Buffer | null;
    wrapped_key?: Buffer | null;
    raw_key_base64?: string | null;
    name?: string | null;
    mime?: string | null;
    size_bytes?: number | null;
  };
  const row = db
    .prepare(
      `SELECT t.token, t.file_id, t.expires_at, t.revoked,
              f.cid, f.iv, f.salt, f.iv_wrap, f.wrapped_key, f.raw_key_base64, f.name, f.mime, f.size_bytes
       FROM tokens t JOIN files f ON f.id = t.file_id WHERE t.token = ?`
    )
    .get(token) as Row | undefined;
  if (!row) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
  if (row.revoked) return NextResponse.json({ ok: false, error: 'Revoked' }, { status: 403 });
  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ ok: false, error: 'Expired' }, { status: 403 });
  }
  return NextResponse.json({
    ok: true,
    fileId: row.file_id,
    cid: row.cid,
    iv: Buffer.isBuffer(row.iv) ? row.iv.toString('base64') : row.iv,
    salt: row.salt ? (Buffer.isBuffer(row.salt) ? row.salt.toString('base64') : row.salt) : undefined,
    ivWrap: row.iv_wrap ? (Buffer.isBuffer(row.iv_wrap) ? row.iv_wrap.toString('base64') : row.iv_wrap) : undefined,
    wrappedKey: row.wrapped_key ? (Buffer.isBuffer(row.wrapped_key) ? row.wrapped_key.toString('base64') : row.wrapped_key) : undefined,
    rawKeyBase64: row.raw_key_base64 ?? undefined,
    name: row.name ?? 'file',
    mime: row.mime ?? 'application/octet-stream',
    sizeBytes: row.size_bytes ?? undefined,
  });
}
