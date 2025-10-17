import { NextResponse } from 'next/server';
import { getSessionAddress } from '@/lib/auth';
import { getDb } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET() {
  const address = await getSessionAddress();
  if (!address) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const db = getDb();
  type Row = { id: string; title: string | null; name: string | null; size_bytes: number | null; created_at: string };
  const rows = db
    .prepare('SELECT id, title, name, size_bytes, created_at FROM files WHERE owner_address = ? ORDER BY created_at DESC LIMIT 500')
    .all(address) as Row[];
  return NextResponse.json({ ok: true, files: rows });
}

