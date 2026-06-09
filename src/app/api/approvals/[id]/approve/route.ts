import { NextResponse } from 'next/server';
import { getSessionAddress } from '@/lib/auth';
import { verifyCsrf } from '@/lib/csrf';
import { getDb } from '@/lib/db';
import { normalizeAddress } from '@/lib/encryptionIdentity';
import { isRecipientSecretEnvelope } from '@/lib/recipientEnvelope';

export const runtime = 'nodejs';

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const address = await getSessionAddress();
  if (!address) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  if (!(await verifyCsrf(req))) return NextResponse.json({ ok: false, error: 'CSRF' }, { status: 403 });
  const { id } = await context.params;
  const { envelope } = await req.json().catch(() => ({})) as { envelope?: unknown };
  if (!isRecipientSecretEnvelope(envelope)) {
    return NextResponse.json({ ok: false, error: 'Invalid approval envelope' }, { status: 400 });
  }
  const db = getDb();
  const normalized = normalizeAddress(address);
  const row = db.prepare(
    `SELECT r.threshold, r.expires_at, s.share_index
     FROM approval_requests r
     JOIN files f ON f.id = r.file_id
     JOIN vault_members m ON m.vault_id = f.vault_id AND m.address = ?
     JOIN threshold_file_shares s ON s.file_id = r.file_id AND s.member_address = m.address
     WHERE r.id = ? AND r.status = 'pending'`
  ).get(normalized, id) as { threshold: number; expires_at: string; share_index: number } | undefined;
  if (!row) return NextResponse.json({ ok: false, error: 'Not an active approver' }, { status: 403 });
  if (new Date(row.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ ok: false, error: 'Request expired' }, { status: 403 });
  }
  const result = db.transaction(() => {
    db.prepare(
      `INSERT INTO approval_contributions
       (request_id, approver_address, share_index, algorithm, ephemeral_public_key_jwk, salt, iv, wrapped_share)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(request_id, approver_address) DO UPDATE SET
         algorithm = excluded.algorithm,
         ephemeral_public_key_jwk = excluded.ephemeral_public_key_jwk,
         salt = excluded.salt,
         iv = excluded.iv,
         wrapped_share = excluded.wrapped_share,
         created_at = CURRENT_TIMESTAMP`
    ).run(
      id, normalized, row.share_index, envelope.algorithm, JSON.stringify(envelope.ephemeralPublicKey),
      Buffer.from(envelope.salt, 'base64'), Buffer.from(envelope.iv, 'base64'), Buffer.from(envelope.wrappedKey, 'base64')
    );
    const count = (db.prepare(
      'SELECT COUNT(*) AS count FROM approval_contributions WHERE request_id = ?'
    ).get(id) as { count: number }).count;
    if (count >= row.threshold) db.prepare(`UPDATE approval_requests SET status = 'approved' WHERE id = ?`).run(id);
    return count;
  })();
  return NextResponse.json({ ok: true, approvalCount: result, threshold: row.threshold });
}
