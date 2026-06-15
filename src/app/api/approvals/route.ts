import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getSessionAddress } from '@/lib/auth';
import { verifyCsrf } from '@/lib/csrf';
import { getDb } from '@/lib/db';
import { normalizeAddress } from '@/lib/encryptionIdentity';
import { getVaultRole } from '@/lib/vaultAccess';
import { recordAudit } from '@/lib/audit';

export const runtime = 'nodejs';

export async function GET() {
  const address = await getSessionAddress();
  if (!address) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  const normalized = normalizeAddress(address);
  const rows = getDb().prepare(
    `SELECT DISTINCT r.id, r.file_id, r.requester_address, r.threshold, r.status, r.expires_at, r.created_at,
            f.title, f.name, v.name AS vault_name,
            (SELECT COUNT(*) FROM approval_contributions c WHERE c.request_id = r.id) AS approval_count,
            CASE WHEN s.member_address IS NOT NULL AND r.requester_address != ? THEN 1 ELSE 0 END AS can_approve,
            CASE WHEN r.requester_address = ? THEN t.token ELSE NULL END AS approved_token
     FROM approval_requests r
     JOIN files f ON f.id = r.file_id
     JOIN vaults v ON v.id = f.vault_id
     JOIN vault_members vm ON vm.vault_id = f.vault_id AND vm.address = ?
     LEFT JOIN threshold_file_shares s ON s.file_id = r.file_id AND s.member_address = ?
     LEFT JOIN tokens t ON t.approval_request_id = r.id AND t.revoked = 0
     WHERE r.requester_address = ? OR s.member_address IS NOT NULL
     ORDER BY r.created_at DESC LIMIT 200`
  ).all(normalized, normalized, normalized, normalized, normalized);
  return NextResponse.json({ ok: true, requests: rows });
}

export async function POST(req: Request) {
  const address = await getSessionAddress();
  if (!address) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  if (!(await verifyCsrf(req))) return NextResponse.json({ ok: false, error: 'CSRF' }, { status: 403 });
  const { fileId, ttlMinutes } = await req.json().catch(() => ({})) as { fileId?: string; ttlMinutes?: number };
  if (!fileId) return NextResponse.json({ ok: false, error: 'Missing fileId' }, { status: 400 });
  const db = getDb();
  const file = db.prepare(
    `SELECT f.vault_id, tf.threshold,
            (SELECT COUNT(*) FROM threshold_file_shares s
             JOIN vault_members m ON m.vault_id = f.vault_id AND m.address = s.member_address
             WHERE s.file_id = f.id) AS eligible_approvers
     FROM files f JOIN threshold_files tf ON tf.file_id = f.id
     WHERE f.id = ? AND f.destroyed_at IS NULL`
  ).get(fileId) as { vault_id: string; threshold: number; eligible_approvers: number } | undefined;
  if (!file || !getVaultRole(db, file.vault_id, address)) {
    return NextResponse.json({ ok: false, error: 'File not found or threshold approval unavailable' }, { status: 404 });
  }
  if (file.eligible_approvers < file.threshold) {
    return NextResponse.json({ ok: false, error: 'Current vault membership cannot satisfy this file threshold' }, { status: 409 });
  }
  const normalized = normalizeAddress(address);
  const identity = db.prepare('SELECT address FROM encryption_identities WHERE address = ?').get(normalized);
  if (!identity) return NextResponse.json({ ok: false, error: 'Requester encryption identity required' }, { status: 400 });
  const requestId = randomUUID();
  const ttl = Math.min(Math.max(ttlMinutes ?? 60, 10), 1440);
  const expiresAt = new Date(Date.now() + ttl * 60_000).toISOString();
  db.transaction(() => {
    db.prepare(
      `INSERT INTO approval_requests (id, file_id, requester_address, threshold, expires_at)
       VALUES (?, ?, ?, ?, ?)`
    ).run(requestId, fileId, normalized, file.threshold, expiresAt);
    recordAudit(db, { actorAddress: normalized, action: 'approval.requested', resourceType: 'file', resourceId: fileId, metadata: { requestId, threshold: file.threshold } });
  })();
  return NextResponse.json({ ok: true, requestId, threshold: file.threshold, expiresAt });
}
