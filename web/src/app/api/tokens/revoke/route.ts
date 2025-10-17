import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSessionAddress } from '@/lib/auth';
import { verifyCsrf } from '@/lib/csrf';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const address = await getSessionAddress();
  if (!address) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await verifyCsrf(req))) return NextResponse.json({ error: 'CSRF' }, { status: 403 });
  const { token } = (await req.json().catch(() => ({}))) as { token?: string };
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 });
  const db = getDb();
  const row = db.prepare(
    `SELECT t.token FROM tokens t JOIN files f ON f.id = t.file_id WHERE t.token = ? AND f.owner_address = ?`
  ).get(token, address) as { token: string } | undefined;
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  db.prepare(`UPDATE tokens SET revoked = 1 WHERE token = ?`).run(token);
  return NextResponse.json({ ok: true });
}

