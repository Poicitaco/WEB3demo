import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSessionAddress } from '@/lib/auth';
import { normalizeAddress } from '@/lib/encryptionIdentity';

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
    issued_to_address?: string | null;
    cid: string;
    iv: Buffer;
    salt?: Buffer | null;
    iv_wrap?: Buffer | null;
    wrapped_key?: Buffer | null;
    raw_key_base64?: string | null;
    name?: string | null;
    mime?: string | null;
    size_bytes?: number | null;
    envelope_algorithm?: string | null;
    ephemeral_public_key_jwk?: string | null;
    envelope_salt?: Buffer | null;
    envelope_iv?: Buffer | null;
    envelope_wrapped_key?: Buffer | null;
  };
  const row = db
    .prepare(
      `SELECT t.token, t.file_id, t.expires_at, t.revoked, t.issued_to_address,
              f.cid, f.iv, f.salt, f.iv_wrap, f.wrapped_key, f.raw_key_base64, f.name, f.mime, f.size_bytes,
              e.algorithm AS envelope_algorithm, e.ephemeral_public_key_jwk,
              e.salt AS envelope_salt, e.iv AS envelope_iv, e.wrapped_key AS envelope_wrapped_key
       FROM tokens t
       JOIN files f ON f.id = t.file_id
       LEFT JOIN key_envelopes e ON e.token = t.token
       WHERE t.token = ?`
    )
    .get(token) as Row | undefined;
  if (!row) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
  if (row.revoked) return NextResponse.json({ ok: false, error: 'Revoked' }, { status: 403 });
  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ ok: false, error: 'Expired' }, { status: 403 });
  }
  if (row.issued_to_address) {
    const sessionAddress = await getSessionAddress();
    if (!sessionAddress || normalizeAddress(sessionAddress) !== normalizeAddress(row.issued_to_address)) {
      return NextResponse.json({ ok: false, error: 'Token is restricted to another wallet' }, { status: 403 });
    }
  }
  const recipientEnvelope = row.envelope_algorithm && row.ephemeral_public_key_jwk && row.envelope_salt && row.envelope_iv && row.envelope_wrapped_key
    ? {
        algorithm: row.envelope_algorithm,
        ephemeralPublicKey: JSON.parse(row.ephemeral_public_key_jwk),
        salt: row.envelope_salt.toString('base64'),
        iv: row.envelope_iv.toString('base64'),
        wrappedKey: row.envelope_wrapped_key.toString('base64'),
      }
    : undefined;
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
    recipientAddress: row.issued_to_address ? normalizeAddress(row.issued_to_address) : undefined,
    recipientEnvelope,
  });
}
