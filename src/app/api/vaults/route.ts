import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getSessionAddress } from '@/lib/auth';
import { verifyCsrf } from '@/lib/csrf';
import { getDb } from '@/lib/db';
import { normalizeAddress } from '@/lib/encryptionIdentity';

export const runtime = 'nodejs';

export async function GET() {
  const address = await getSessionAddress();
  if (!address) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  const rows = getDb().prepare(
    `SELECT v.id, v.name, v.description, v.owner_address, v.created_at, m.role,
            (SELECT COUNT(*) FROM vault_members vm WHERE vm.vault_id = v.id) AS member_count,
            (SELECT COUNT(*) FROM files f WHERE f.vault_id = v.id) AS file_count
     FROM vault_members m JOIN vaults v ON v.id = m.vault_id
     WHERE m.address = ? ORDER BY v.created_at DESC`
  ).all(normalizeAddress(address));
  return NextResponse.json({ ok: true, vaults: rows });
}

export async function POST(req: Request) {
  const address = await getSessionAddress();
  if (!address) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  if (!(await verifyCsrf(req))) return NextResponse.json({ ok: false, error: 'CSRF' }, { status: 403 });
  const { name, description } = await req.json().catch(() => ({})) as {
    name?: string;
    description?: string;
  };
  const cleanName = name?.trim() ?? '';
  if (!cleanName || cleanName.length > 100) {
    return NextResponse.json({ ok: false, error: 'Vault name must be 1-100 characters' }, { status: 400 });
  }
  if (description && description.length > 500) {
    return NextResponse.json({ ok: false, error: 'Description too long' }, { status: 400 });
  }
  const db = getDb();
  const vaultId = randomUUID();
  const owner = normalizeAddress(address);
  db.transaction(() => {
    db.prepare('INSERT INTO vaults (id, name, description, owner_address) VALUES (?, ?, ?, ?)')
      .run(vaultId, cleanName, description?.trim() || null, owner);
    db.prepare('INSERT INTO vault_members (vault_id, address, role, added_by) VALUES (?, ?, ?, ?)')
      .run(vaultId, owner, 'owner', owner);
  })();
  return NextResponse.json({ ok: true, vaultId });
}
