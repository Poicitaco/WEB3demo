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
    CREATE TABLE IF NOT EXISTS files (
      id TEXT PRIMARY KEY,
      owner_address TEXT NOT NULL,
      title TEXT,
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
  `);
}

