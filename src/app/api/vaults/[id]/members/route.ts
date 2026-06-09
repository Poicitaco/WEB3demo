import { NextResponse } from 'next/server';
import { getSessionAddress } from '@/lib/auth';
import { verifyCsrf } from '@/lib/csrf';
import { getDb } from '@/lib/db';
import { normalizeAddress } from '@/lib/encryptionIdentity';
import { canManageVault, getVaultRole, isVaultRole } from '@/lib/vaultAccess';

export const runtime = 'nodejs';

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const address = await getSessionAddress();
  if (!address) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  const { id } = await context.params;
  const db = getDb();
  if (!getVaultRole(db, id, address)) {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }
  const rows = db.prepare(
    `SELECT m.address, m.role, m.created_at, i.algorithm, i.public_key_jwk
     FROM vault_members m LEFT JOIN encryption_identities i ON i.address = m.address
     WHERE m.vault_id = ? ORDER BY m.created_at`
  ).all(id) as Array<{
    address: string;
    role: string;
    created_at: string;
    algorithm: string | null;
    public_key_jwk: string | null;
  }>;
  const members = rows.map((member) => ({
    address: member.address,
    role: member.role,
    createdAt: member.created_at,
    encryptionIdentity: member.public_key_jwk ? {
      algorithm: member.algorithm,
      publicKey: JSON.parse(member.public_key_jwk),
    } : null,
  }));
  return NextResponse.json({ ok: true, members });
}

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const address = await getSessionAddress();
  if (!address) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  if (!(await verifyCsrf(req))) return NextResponse.json({ ok: false, error: 'CSRF' }, { status: 403 });
  const { id } = await context.params;
  const { memberAddress, role } = await req.json().catch(() => ({})) as {
    memberAddress?: string;
    role?: unknown;
  };
  if (!memberAddress || !/^0x[a-fA-F0-9]{40}$/.test(memberAddress) || !isVaultRole(role) || role === 'owner') {
    return NextResponse.json({ ok: false, error: 'Invalid member or role' }, { status: 400 });
  }
  const db = getDb();
  if (!canManageVault(getVaultRole(db, id, address))) {
    return NextResponse.json({ ok: false, error: 'Only the vault owner can manage members' }, { status: 403 });
  }
  const target = normalizeAddress(memberAddress);
  const vault = db.prepare('SELECT owner_address FROM vaults WHERE id = ?').get(id) as { owner_address: string } | undefined;
  if (!vault) return NextResponse.json({ ok: false, error: 'Vault not found' }, { status: 404 });
  if (target === vault.owner_address) {
    return NextResponse.json({ ok: false, error: 'Vault owner role cannot be changed' }, { status: 400 });
  }
  db.transaction(() => {
    db.prepare(
      `INSERT INTO vault_members (vault_id, address, role, added_by) VALUES (?, ?, ?, ?)
       ON CONFLICT(vault_id, address) DO UPDATE SET role = excluded.role, added_by = excluded.added_by`
    ).run(id, target, role, normalizeAddress(address));
    db.prepare('DELETE FROM vault_threshold_policies WHERE vault_id = ?').run(id);
  })();
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  const address = await getSessionAddress();
  if (!address) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  if (!(await verifyCsrf(req))) return NextResponse.json({ ok: false, error: 'CSRF' }, { status: 403 });
  const { id } = await context.params;
  const { memberAddress } = await req.json().catch(() => ({})) as { memberAddress?: string };
  if (!memberAddress || !/^0x[a-fA-F0-9]{40}$/.test(memberAddress)) {
    return NextResponse.json({ ok: false, error: 'Invalid member address' }, { status: 400 });
  }
  const db = getDb();
  if (!canManageVault(getVaultRole(db, id, address))) {
    return NextResponse.json({ ok: false, error: 'Only the vault owner can manage members' }, { status: 403 });
  }
  const member = normalizeAddress(memberAddress);
  if (member === normalizeAddress(address)) {
    return NextResponse.json({ ok: false, error: 'Vault owner cannot be removed' }, { status: 400 });
  }
  db.transaction(() => {
    db.prepare('DELETE FROM vault_members WHERE vault_id = ? AND address = ?').run(id, member);
    db.prepare('DELETE FROM vault_threshold_policies WHERE vault_id = ?').run(id);
  })();
  return NextResponse.json({ ok: true });
}
