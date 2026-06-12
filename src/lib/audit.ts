import type Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { normalizeAddress } from './encryptionIdentity';

type AuditEvent = {
  actorAddress?: string | null;
  action: string;
  resourceType: 'auth' | 'file' | 'token' | 'vault' | 'approval' | 'identity';
  resourceId?: string | null;
  outcome?: 'success' | 'denied' | 'failure';
  metadata?: Record<string, string | number | boolean | null | undefined>;
};

export function recordAudit(db: Database.Database, event: AuditEvent) {
  const metadata = event.metadata
    ? Object.fromEntries(Object.entries(event.metadata).filter(([, value]) => value !== undefined))
    : null;
  db.prepare(
    `INSERT INTO audit_events
     (id, actor_address, action, resource_type, resource_id, outcome, metadata_json)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    randomUUID(),
    event.actorAddress ? normalizeAddress(event.actorAddress) : null,
    event.action,
    event.resourceType,
    event.resourceId ?? null,
    event.outcome ?? 'success',
    metadata ? JSON.stringify(metadata) : null
  );
}
