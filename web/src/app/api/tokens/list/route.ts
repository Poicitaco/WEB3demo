import { NextResponse } from 'next/server';
import { getSessionAddress } from '@/lib/auth';
import { getDb } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET() {
  const address = await getSessionAddress();
  if (!address) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const db = getDb();
  type Row = {
    token: string; file_id: string; revoked: number; expires_at: string | null; created_at: string;
    title: string | null; name: string | null; size_bytes: number | null;
  };
  const rows = db.prepare(
    `SELECT t.token, t.file_id, t.revoked, t.expires_at, t.created_at,
            f.title, f.name, f.size_bytes
     FROM tokens t JOIN files f ON f.id = t.file_id WHERE f.owner_address = ?
     ORDER BY t.created_at DESC LIMIT 500`
  ).all(address) as Row[];
  return NextResponse.json({ ok: true, tokens: rows });
}

