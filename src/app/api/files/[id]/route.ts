import { NextResponse } from 'next/server';
import { getSessionAddress } from '@/lib/auth';
import { verifyCsrf } from '@/lib/csrf';
import { getDb } from '@/lib/db';
import { normalizeAddress } from '@/lib/encryptionIdentity';
import { recordAudit } from '@/lib/audit';
import { deleteCiphertext } from '@/lib/storage';

export const runtime = 'nodejs';

export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  const address = await getSessionAddress();
  if (!address) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  if (!(await verifyCsrf(req))) return NextResponse.json({ ok: false, error: 'CSRF' }, { status: 403 });

  const { id } = await context.params;
  const normalized = normalizeAddress(address);
  const db = getDb();
  const file = db.prepare(
    `SELECT id, cid, owner_address, destroyed_at
     FROM files WHERE id = ?`
  ).get(id) as {
    id: string;
    cid: string;
    owner_address: string;
    destroyed_at: string | null;
  } | undefined;

  if (!file || normalizeAddress(file.owner_address) !== normalized) {
    return NextResponse.json({ ok: false, error: 'File not found or forbidden' }, { status: 404 });
  }
  if (file.destroyed_at) {
    return NextResponse.json({ ok: true, alreadyDestroyed: true, ciphertextDeleted: false });
  }

  const shouldDeleteCiphertext = db.transaction(() => {
    db.prepare(`UPDATE files SET destroyed_at = CURRENT_TIMESTAMP WHERE id = ?`).run(id);
    db.prepare(`UPDATE tokens SET revoked = 1 WHERE file_id = ?`).run(id);
    db.prepare(
      `UPDATE approval_requests SET status = 'cancelled'
       WHERE file_id = ? AND status = 'pending'`
    ).run(id);
    recordAudit(db, {
      actorAddress: normalized,
      action: 'file.destroyed',
      resourceType: 'file',
      resourceId: id,
      metadata: { reason: 'owner_requested' },
    });
    const activeReferences = db.prepare(
      `SELECT COUNT(*) AS count FROM files
       WHERE cid = ? AND destroyed_at IS NULL`
    ).get(file.cid) as { count: number };
    return activeReferences.count === 0;
  })();

  let ciphertextDeleted = false;
  if (shouldDeleteCiphertext) {
    try {
      ciphertextDeleted = await deleteCiphertext(file.cid);
    } catch (error) {
      recordAudit(db, {
        actorAddress: normalized,
        action: 'file.ciphertext_delete_failed',
        resourceType: 'file',
        resourceId: id,
        outcome: 'failure',
        metadata: { message: error instanceof Error ? error.message.slice(0, 160) : 'Unknown storage error' },
      });
      return NextResponse.json({
        ok: true,
        ciphertextDeleted: false,
        warning: 'Access was revoked, but ciphertext cleanup must be retried',
      });
    }
  }

  return NextResponse.json({ ok: true, ciphertextDeleted });
}
