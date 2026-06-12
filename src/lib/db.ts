import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';

let db: Database.Database | null = null;

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export function getDb() {
  if (db) return db;
  const dataDir = path.join(process.cwd(), 'data');
  ensureDir(dataDir);
  const dbPath = path.join(dataDir, 'app.sqlite');
  db = new Database(dbPath);
  migrate(db);
  return db;
}

function migrate(d: Database.Database) {
  d.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS files (
      id TEXT PRIMARY KEY,
      owner_address TEXT NOT NULL,
      title TEXT,
      description TEXT,
      cid TEXT NOT NULL,
      name TEXT,
      mime TEXT,
      size_bytes INTEGER,
      iv BLOB NOT NULL,
      salt BLOB,
      iv_wrap BLOB,
      wrapped_key BLOB,
      raw_key_base64 TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tokens (
      token TEXT PRIMARY KEY,
      file_id TEXT NOT NULL,
      issued_to_address TEXT,
      expires_at DATETIME,
      revoked INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(file_id) REFERENCES files(id)
    );

    CREATE TABLE IF NOT EXISTS encryption_identities (
      address TEXT PRIMARY KEY,
      algorithm TEXT NOT NULL,
      public_key_jwk TEXT NOT NULL,
      wallet_signature TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS key_envelopes (
      token TEXT PRIMARY KEY,
      recipient_address TEXT NOT NULL,
      algorithm TEXT NOT NULL,
      ephemeral_public_key_jwk TEXT NOT NULL,
      salt BLOB NOT NULL,
      iv BLOB NOT NULL,
      wrapped_key BLOB NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(token) REFERENCES tokens(token)
    );

    CREATE TABLE IF NOT EXISTS vaults (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      owner_address TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS vault_members (
      vault_id TEXT NOT NULL,
      address TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('owner', 'editor', 'viewer')),
      added_by TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(vault_id, address),
      FOREIGN KEY(vault_id) REFERENCES vaults(id)
    );

    CREATE TABLE IF NOT EXISTS vault_threshold_policies (
      vault_id TEXT PRIMARY KEY,
      threshold INTEGER NOT NULL,
      total_shares INTEGER NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      updated_by TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(vault_id) REFERENCES vaults(id)
    );

    CREATE TABLE IF NOT EXISTS threshold_file_shares (
      file_id TEXT NOT NULL,
      member_address TEXT NOT NULL,
      share_index INTEGER NOT NULL,
      algorithm TEXT NOT NULL,
      ephemeral_public_key_jwk TEXT NOT NULL,
      salt BLOB NOT NULL,
      iv BLOB NOT NULL,
      wrapped_share BLOB NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(file_id, member_address),
      FOREIGN KEY(file_id) REFERENCES files(id)
    );

    CREATE TABLE IF NOT EXISTS threshold_files (
      file_id TEXT PRIMARY KEY,
      threshold INTEGER NOT NULL,
      total_shares INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(file_id) REFERENCES files(id)
    );

    CREATE TABLE IF NOT EXISTS approval_requests (
      id TEXT PRIMARY KEY,
      file_id TEXT NOT NULL,
      requester_address TEXT NOT NULL,
      threshold INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'expired', 'cancelled')),
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(file_id) REFERENCES files(id)
    );

    CREATE TABLE IF NOT EXISTS approval_contributions (
      request_id TEXT NOT NULL,
      approver_address TEXT NOT NULL,
      share_index INTEGER NOT NULL,
      algorithm TEXT NOT NULL,
      ephemeral_public_key_jwk TEXT NOT NULL,
      salt BLOB NOT NULL,
      iv BLOB NOT NULL,
      wrapped_share BLOB NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(request_id, approver_address),
      FOREIGN KEY(request_id) REFERENCES approval_requests(id)
    );
  `);
  // Ensure columns exist if DB was created before adding new fields
  const info = d.prepare(`PRAGMA table_info(files)`).all() as Array<{ name: string }>;
  const names = new Set(info.map((c) => c.name));
  if (!names.has('description')) {
    d.exec(`ALTER TABLE files ADD COLUMN description TEXT`);
  }
  if (!names.has('vault_id')) {
    d.exec(`ALTER TABLE files ADD COLUMN vault_id TEXT REFERENCES vaults(id)`);
  }
  if (!names.has('logical_file_id')) {
    d.exec(`ALTER TABLE files ADD COLUMN logical_file_id TEXT`);
    d.exec(`UPDATE files SET logical_file_id = id WHERE logical_file_id IS NULL`);
  }
  if (!names.has('version_number')) {
    d.exec(`ALTER TABLE files ADD COLUMN version_number INTEGER NOT NULL DEFAULT 1`);
  }
  if (!names.has('max_downloads')) {
    d.exec(`ALTER TABLE files ADD COLUMN max_downloads INTEGER`);
  }
  if (!names.has('download_count')) {
    d.exec(`ALTER TABLE files ADD COLUMN download_count INTEGER NOT NULL DEFAULT 0`);
  }
  if (!names.has('destroyed_at')) {
    d.exec(`ALTER TABLE files ADD COLUMN destroyed_at DATETIME`);
  }
  d.exec(`
    CREATE INDEX IF NOT EXISTS idx_files_vault_id ON files(vault_id);
    CREATE INDEX IF NOT EXISTS idx_vault_members_address ON vault_members(address);
    CREATE INDEX IF NOT EXISTS idx_tokens_file_id ON tokens(file_id);
    CREATE INDEX IF NOT EXISTS idx_files_logical_file_id ON files(logical_file_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_files_logical_version ON files(logical_file_id, version_number);
    CREATE INDEX IF NOT EXISTS idx_threshold_file_shares_member ON threshold_file_shares(member_address);
    CREATE INDEX IF NOT EXISTS idx_approval_requests_requester ON approval_requests(requester_address);
  `);
}
