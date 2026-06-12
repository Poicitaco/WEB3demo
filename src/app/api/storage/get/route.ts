import { NextResponse } from 'next/server';
import { getCiphertext, ciphertextExists } from '@/lib/storage';
import { getDb } from '@/lib/db';
import { getSessionAddress } from '@/lib/auth';
import { normalizeAddress } from '@/lib/encryptionIdentity';
import { consumeRateLimit, rateLimitHeaders, requestIdentifier } from '@/lib/rateLimit';
import { recordAudit } from '@/lib/audit';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const rateLimit = consumeRateLimit('storage:download', requestIdentifier(req), 240, 60);
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: 'Download rate limit exceeded' }, { status: 429, headers: rateLimitHeaders(rateLimit) });
  }
  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token');
  const approvalRequestId = searchParams.get('approvalRequestId');
  const db = getDb();
  if (approvalRequestId) {
    const address = await getSessionAddress();
    if (!address) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const approved = db.prepare(
      `SELECT f.id AS file_id, f.cid, r.expires_at FROM approval_requests r JOIN files f ON f.id = r.file_id
       WHERE r.id = ? AND r.requester_address = ? AND r.status = 'approved'
         AND f.destroyed_at IS NULL`
    ).get(approvalRequestId, normalizeAddress(address)) as { file_id: string; cid: string; expires_at: string } | undefined;
    if (!approved || new Date(approved.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ error: 'Approval request not found or unavailable' }, { status: 404 });
    }
    recordAudit(db, { actorAddress: address, action: 'file.downloaded', resourceType: 'file', resourceId: approved.file_id, metadata: { via: 'threshold_approval' } });
    const response = await getCiphertext(approved.cid);
    Object.entries(rateLimitHeaders(rateLimit)).forEach(([key, value]) => response.headers.set(key, value));
    return response;
  }
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 });
  const row = db.prepare(
    `SELECT t.file_id, t.issued_to_address, t.expires_at, t.revoked,
            f.cid, f.max_downloads, f.download_count, f.destroyed_at,
            tf.file_id AS threshold_file_id
     FROM tokens t JOIN files f ON f.id = t.file_id
     LEFT JOIN threshold_files tf ON tf.file_id = f.id
     WHERE t.token = ?`
  ).get(token) as {
    file_id: string; issued_to_address: string | null; expires_at: string | null; revoked: number;
    cid: string; max_downloads: number | null; download_count: number; destroyed_at: string | null;
    threshold_file_id: string | null;
  } | undefined;
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (row.revoked || row.destroyed_at) return NextResponse.json({ error: 'Token or file unavailable' }, { status: 410 });
  if (row.threshold_file_id) {
    return NextResponse.json({ error: 'Threshold approval required' }, { status: 403 });
  }
  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: 'Expired' }, { status: 403 });
  }
  if (row.issued_to_address) {
    const address = await getSessionAddress();
    if (!address || normalizeAddress(address) !== normalizeAddress(row.issued_to_address)) {
      return NextResponse.json({ error: 'Token is restricted to another wallet' }, { status: 403 });
    }
  }
  if (!(await ciphertextExists(row.cid))) return NextResponse.json({ error: 'Ciphertext not found' }, { status: 404 });
  let destroyAfterRead = false;
  if (row.max_downloads !== null) {
    const consume = db.transaction(() => {
      const result = db.prepare(
        `UPDATE files SET download_count = download_count + 1,
             destroyed_at = CASE WHEN download_count + 1 >= max_downloads THEN CURRENT_TIMESTAMP ELSE destroyed_at END
         WHERE id = ? AND destroyed_at IS NULL AND download_count < max_downloads`
      ).run(row.file_id);
      if (result.changes !== 1) return null;
      return db.prepare('SELECT download_count, max_downloads FROM files WHERE id = ?').get(row.file_id) as {
        download_count: number; max_downloads: number;
      };
    })();
    if (!consume) return NextResponse.json({ error: 'File has self-destructed' }, { status: 410 });
    if (consume.download_count >= consume.max_downloads) {
      const activeReferences = db.prepare(
        'SELECT COUNT(*) AS count FROM files WHERE cid = ? AND destroyed_at IS NULL'
      ).get(row.cid) as { count: number };
      destroyAfterRead = activeReferences.count === 0;
    }
  }
  recordAudit(db, {
    actorAddress: await getSessionAddress(),
    action: 'file.downloaded',
    resourceType: 'file',
    resourceId: row.file_id,
    metadata: { via: 'token', selfDestructed: destroyAfterRead },
  });
  const response = await getCiphertext(row.cid, destroyAfterRead);
  Object.entries(rateLimitHeaders(rateLimit)).forEach(([key, value]) => response.headers.set(key, value));
  return response;
}
