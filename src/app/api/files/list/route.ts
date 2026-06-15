import { NextResponse } from 'next/server';
import { getSessionAddress } from '@/lib/auth';
import { getDb } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET() {
  const address = await getSessionAddress();
  if (!address) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const db = getDb();
  type Row = {
    id: string; title: string | null; name: string | null; size_bytes: number | null; created_at: string;
    vault_id: string | null; vault_name: string | null; logical_file_id: string | null; version_number: number;
  };
  const rows = db
    .prepare(
      `SELECT DISTINCT f.id, f.title, f.name, f.size_bytes, f.created_at, f.vault_id, v.name AS vault_name,
              f.logical_file_id, f.version_number
       FROM files f
       LEFT JOIN vaults v ON v.id = f.vault_id
       LEFT JOIN vault_members m ON m.vault_id = f.vault_id AND m.address = ?
       WHERE f.destroyed_at IS NULL
         AND ((f.vault_id IS NULL AND f.owner_address = ?) OR m.address IS NOT NULL)
       ORDER BY f.created_at DESC LIMIT 500`
    )
    .all(address.toLowerCase(), address) as Row[];
  return NextResponse.json({ ok: true, files: rows });
}

