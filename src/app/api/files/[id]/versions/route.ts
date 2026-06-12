import { NextResponse } from 'next/server';
import { getSessionAddress } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { canReadFile } from '@/lib/vaultAccess';

export const runtime = 'nodejs';

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const address = await getSessionAddress();
  if (!address) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  const { id } = await context.params;
  const db = getDb();
  if (!canReadFile(db, id, address)) {
    return NextResponse.json({ ok: false, error: 'Not found or forbidden' }, { status: 404 });
  }
  const file = db.prepare(
    'SELECT logical_file_id FROM files WHERE id = ?'
  ).get(id) as { logical_file_id: string | null };
  const logicalFileId = file.logical_file_id || id;
  const versions = db.prepare(
    `SELECT id, logical_file_id, version_number, title, name, mime, size_bytes, owner_address, created_at,
            max_downloads, download_count, destroyed_at
     FROM files WHERE logical_file_id = ? ORDER BY version_number DESC`
  ).all(logicalFileId);
  return NextResponse.json({ ok: true, logicalFileId, versions });
}
