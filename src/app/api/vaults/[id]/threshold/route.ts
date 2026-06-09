import { NextResponse } from 'next/server';
import { getSessionAddress } from '@/lib/auth';
import { verifyCsrf } from '@/lib/csrf';
import { getDb } from '@/lib/db';
import { normalizeAddress } from '@/lib/encryptionIdentity';
import { canManageVault, getVaultRole } from '@/lib/vaultAccess';

export const runtime = 'nodejs';

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const address = await getSessionAddress();
  if (!address) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  const { id } = await context.params;
  const db = getDb();
  if (!getVaultRole(db, id, address)) {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }
  const policy = db.prepare(
    'SELECT threshold, total_shares, enabled, updated_at FROM vault_threshold_policies WHERE vault_id = ?'
  ).get(id);
  return NextResponse.json({ ok: true, policy: policy ?? null });
}

export async function PUT(req: Request, context: { params: Promise<{ id: string }> }) {
  const address = await getSessionAddress();
  if (!address) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  if (!(await verifyCsrf(req))) return NextResponse.json({ ok: false, error: 'CSRF' }, { status: 403 });
  const { id } = await context.params;
  const { threshold } = await req.json().catch(() => ({})) as { threshold?: number };
  const db = getDb();
  if (!canManageVault(getVaultRole(db, id, address))) {
    return NextResponse.json({ ok: false, error: 'Only the vault owner can configure threshold approval' }, { status: 403 });
  }
  const members = db.prepare(
    `SELECT m.address, i.address AS identity_address
     FROM vault_members m
     LEFT JOIN encryption_identities i ON i.address = m.address
     WHERE m.vault_id = ? ORDER BY m.created_at`
  ).all(id) as Array<{ address: string; identity_address: string | null }>;
  if (!Number.isInteger(threshold) || !threshold || threshold < 2 || threshold > members.length) {
    return NextResponse.json({ ok: false, error: `Threshold must be between 2 and ${members.length}` }, { status: 400 });
  }
  const missingIdentity = members.filter((member) => !member.identity_address).map((member) => member.address);
  if (missingIdentity.length > 0) {
    return NextResponse.json(
      { ok: false, error: 'Every vault member must enable an encryption identity', missingIdentity },
      { status: 400 }
    );
  }
  db.prepare(
    `INSERT INTO vault_threshold_policies (vault_id, threshold, total_shares, enabled, updated_by)
     VALUES (?, ?, ?, 1, ?)
     ON CONFLICT(vault_id) DO UPDATE SET
       threshold = excluded.threshold,
       total_shares = excluded.total_shares,
       enabled = 1,
       updated_by = excluded.updated_by,
       updated_at = CURRENT_TIMESTAMP`
  ).run(id, threshold, members.length, normalizeAddress(address));
  return NextResponse.json({ ok: true, policy: { threshold, totalShares: members.length } });
}

export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  const address = await getSessionAddress();
  if (!address) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  if (!(await verifyCsrf(req))) return NextResponse.json({ ok: false, error: 'CSRF' }, { status: 403 });
  const { id } = await context.params;
  const db = getDb();
  if (!canManageVault(getVaultRole(db, id, address))) {
    return NextResponse.json({ ok: false, error: 'Only the vault owner can disable threshold approval' }, { status: 403 });
  }
  db.prepare('DELETE FROM vault_threshold_policies WHERE vault_id = ?').run(id);
  return NextResponse.json({ ok: true });
}
