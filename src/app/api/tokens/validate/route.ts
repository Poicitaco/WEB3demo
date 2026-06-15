import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSessionAddress } from '@/lib/auth';
import { normalizeAddress } from '@/lib/encryptionIdentity';
import { consumeRateLimit, rateLimitHeaders, requestIdentifier } from '@/lib/rateLimit';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const sessionAddress = await getSessionAddress();
  if (!sessionAddress) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  const rateLimit = consumeRateLimit('token:validate', requestIdentifier(req), 120, 60);
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: 'Too many token validation attempts' }, { status: 429, headers: rateLimitHeaders(rateLimit) });
  }
  const { token } = (await req.json().catch(() => ({}))) as { token?: string };
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 });
  const db = getDb();
  type Row = {
    token: string;
    file_id: string;
    expires_at: string | null;
    revoked: number;
    issued_to_address?: string | null;
    approval_request_id?: string | null;
    purpose?: 'share' | 'approval';
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
    threshold_file_id?: string | null;
    approval_status?: string | null;
    approval_requester?: string | null;
    max_downloads?: number | null;
    download_count: number;
    destroyed_at?: string | null;
    access_mode: 'download' | 'view';
  };
  const row = db
    .prepare(
      `SELECT t.token, t.file_id, t.expires_at, t.revoked, t.issued_to_address, t.approval_request_id, t.purpose,
              f.cid, f.iv, f.salt, f.iv_wrap, f.wrapped_key, f.raw_key_base64, f.name, f.mime, f.size_bytes,
              f.max_downloads, f.download_count, f.destroyed_at, f.access_mode,
              e.algorithm AS envelope_algorithm, e.ephemeral_public_key_jwk,
              e.salt AS envelope_salt, e.iv AS envelope_iv, e.wrapped_key AS envelope_wrapped_key
              , tf.file_id AS threshold_file_id,
              ar.status AS approval_status,
              ar.requester_address AS approval_requester
       FROM tokens t
       JOIN files f ON f.id = t.file_id
       LEFT JOIN key_envelopes e ON e.token = t.token
       LEFT JOIN threshold_files tf ON tf.file_id = f.id
       LEFT JOIN approval_requests ar ON ar.id = t.approval_request_id
       WHERE t.token = ?`
    )
    .get(token) as Row | undefined;
  if (!row) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
  if (row.revoked) return NextResponse.json({ ok: false, error: 'Revoked' }, { status: 403 });
  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ ok: false, error: 'Expired' }, { status: 403 });
  }
  if (row.destroyed_at) return NextResponse.json({ ok: false, error: 'File has self-destructed' }, { status: 410 });
  if (row.issued_to_address) {
    if (normalizeAddress(sessionAddress) !== normalizeAddress(row.issued_to_address)) {
      return NextResponse.json({ ok: false, error: 'Token is restricted to another wallet' }, { status: 403 });
    }
  }
  const normalizedSession = normalizeAddress(sessionAddress);
  const approvalGranted = Boolean(
    row.threshold_file_id &&
    row.purpose === 'approval' &&
    row.approval_request_id &&
    row.approval_status === 'approved' &&
    row.approval_requester &&
    normalizeAddress(row.approval_requester) === normalizedSession
  );
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
    thresholdProtected: Boolean(row.threshold_file_id) && !approvalGranted,
    approvalGranted,
    approvalRequestId: approvalGranted ? row.approval_request_id : undefined,
    maxDownloads: row.max_downloads ?? undefined,
    remainingDownloads: row.max_downloads == null ? undefined : Math.max(0, row.max_downloads - row.download_count),
    accessMode: row.access_mode,
  }, { headers: rateLimitHeaders(rateLimit) });
}
