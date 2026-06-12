import type Database from 'better-sqlite3';
import { normalizeAddress } from '@/lib/encryptionIdentity';

export type VaultRole = 'owner' | 'editor' | 'viewer';

export function isVaultRole(value: unknown): value is VaultRole {
  return value === 'owner' || value === 'editor' || value === 'viewer';
}

export function getVaultRole(db: Database.Database, vaultId: string, address: string) {
  const row = db.prepare(
    'SELECT role FROM vault_members WHERE vault_id = ? AND address = ?'
  ).get(vaultId, normalizeAddress(address)) as { role: VaultRole } | undefined;
  return row?.role ?? null;
}

export function canWriteVault(role: VaultRole | null) {
  return role === 'owner' || role === 'editor';
}

export function canManageVault(role: VaultRole | null) {
  return role === 'owner';
}

export function canManageFile(db: Database.Database, fileId: string, address: string) {
  const row = db.prepare(
    `SELECT owner_address, vault_id FROM files WHERE id = ?`
  ).get(fileId) as { owner_address: string; vault_id: string | null } | undefined;
  if (!row) return false;
  if (row.vault_id) return canWriteVault(getVaultRole(db, row.vault_id, address));
  return normalizeAddress(row.owner_address) === normalizeAddress(address);
}

export function canReadFile(db: Database.Database, fileId: string, address: string) {
  const row = db.prepare(
    'SELECT owner_address, vault_id FROM files WHERE id = ?'
  ).get(fileId) as { owner_address: string; vault_id: string | null } | undefined;
  if (!row) return false;
  if (row.vault_id) return Boolean(getVaultRole(db, row.vault_id, address));
  return normalizeAddress(row.owner_address) === normalizeAddress(address);
}
