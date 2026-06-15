import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { getSessionAddress } from '@/lib/auth';
import { verifyCsrf } from '@/lib/csrf';
import { getDb } from '@/lib/db';
import { normalizeAddress } from '@/lib/encryptionIdentity';
import { isRecipientSecretEnvelope } from '@/lib/recipientEnvelope';
import { recordAudit } from '@/lib/audit';

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
    `SELECT r.file_id, r.requester_address, r.threshold, r.expires_at, s.share_index
     FROM approval_requests r
     JOIN files f ON f.id = r.file_id
     JOIN vault_members m ON m.vault_id = f.vault_id AND m.address = ?
     JOIN threshold_file_shares s ON s.file_id = r.file_id AND s.member_address = m.address
     WHERE r.id = ? AND r.status = 'pending' AND r.requester_address != ?`
  ).get(normalized, id, normalized) as {
    file_id: string;
    requester_address: string;
    threshold: number;
    expires_at: string;
    share_index: number;
  } | undefined;
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
    let approvedToken: { token: string; expiresAt: string | null } | undefined;
    if (count >= row.threshold) {
      db.prepare(`UPDATE approval_requests SET status = 'approved' WHERE id = ?`).run(id);
      const existing = db.prepare(
        `SELECT token, expires_at FROM tokens
         WHERE approval_request_id = ? AND issued_to_address = ? AND revoked = 0
         ORDER BY created_at DESC LIMIT 1`
      ).get(id, row.requester_address) as { token: string; expires_at: string | null } | undefined;
      if (existing) {
        approvedToken = { token: existing.token, expiresAt: existing.expires_at };
      } else {
        const token = randomUUID();
        db.prepare(
          `INSERT INTO tokens (token, file_id, issued_to_address, expires_at, revoked, approval_request_id, purpose)
           VALUES (?, ?, ?, ?, 0, ?, 'approval')`
        ).run(token, row.file_id, row.requester_address, row.expires_at, id);
        approvedToken = { token, expiresAt: row.expires_at };
        recordAudit(db, {
          actorAddress: row.requester_address,
          action: 'token.issued',
          resourceType: 'file',
          resourceId: row.file_id,
          metadata: { requestId: id, approvalToken: true, threshold: row.threshold },
        });
      }
    }
    recordAudit(db, {
      actorAddress: normalized,
      action: 'approval.contributed',
      resourceType: 'file',
      resourceId: row.file_id,
      metadata: { requestId: id, approvalCount: count, threshold: row.threshold },
    });
    return { approvalCount: count, approvedToken };
  })();
  return NextResponse.json({
    ok: true,
    approvalCount: result.approvalCount,
    threshold: row.threshold,
    token: result.approvedToken?.token,
    expiresAt: result.approvedToken?.expiresAt,
  });
}
