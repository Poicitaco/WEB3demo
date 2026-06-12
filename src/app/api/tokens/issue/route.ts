import { NextResponse } from 'next/server';
import { getSessionAddress } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { randomUUID } from 'node:crypto';
import { verifyCsrf } from '@/lib/csrf';
import { normalizeAddress } from '@/lib/encryptionIdentity';
import { canManageFile } from '@/lib/vaultAccess';
import { recordAudit } from '@/lib/audit';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const address = await getSessionAddress();
  if (!address) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await verifyCsrf(req))) return NextResponse.json({ error: 'CSRF' }, { status: 403 });
  const { fileId, ttlMinutes, issuedTo } = (await req.json().catch(() => ({}))) as {
    fileId?: string;
    ttlMinutes?: number;
    issuedTo?: string | null;
  };
  if (!fileId) return NextResponse.json({ error: 'Missing fileId' }, { status: 400 });
  const recipient = issuedTo?.trim() || null;
  if (recipient && !/^0x[a-fA-F0-9]{40}$/.test(recipient)) {
    return NextResponse.json({ error: 'Invalid recipient address' }, { status: 400 });
  }
  const db = getDb();
  if (!canManageFile(db, fileId, address)) return NextResponse.json({ error: 'Not found or forbidden' }, { status: 404 });
  const token = randomUUID();
  const ttl = (typeof ttlMinutes === 'number' && ttlMinutes > 0 ? ttlMinutes : 24 * 60) * 60 * 1000;
  const expiresAt = new Date(Date.now() + ttl).toISOString();
  db.transaction(() => {
    db.prepare('INSERT INTO tokens (token, file_id, issued_to_address, expires_at, revoked) VALUES (?, ?, ?, ?, 0)')
      .run(token, fileId, recipient ? normalizeAddress(recipient) : null, expiresAt);
    recordAudit(db, {
      actorAddress: address,
      action: 'token.issued',
      resourceType: 'file',
      resourceId: fileId,
      metadata: { fileId, recipientRestricted: Boolean(recipient), ttlMinutes: typeof ttlMinutes === 'number' ? ttlMinutes : 1440 },
    });
  })();
  return NextResponse.json({ ok: true, token, expiresAt });
}

