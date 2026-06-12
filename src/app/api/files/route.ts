import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSessionAddress } from '@/lib/auth';
import { randomUUID } from 'node:crypto';
import { verifyCsrf } from '@/lib/csrf';
import { isRecipientKeyEnvelope } from '@/lib/recipientEnvelope';
import { normalizeAddress } from '@/lib/encryptionIdentity';
import { canManageFile, canWriteVault, getVaultRole } from '@/lib/vaultAccess';
import { isThresholdShareEnvelope, type ThresholdShareEnvelope } from '@/lib/thresholdBundle';
import { recordAudit } from '@/lib/audit';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const address = await getSessionAddress();
  if (!address) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await verifyCsrf(req))) return NextResponse.json({ error: 'CSRF' }, { status: 403 });

  const body = await req.json();
  const {
    title,
    description,
    cid,
    fileName,
    mime,
    sizeBytes,
    iv,
    salt,
    ivWrap,
    wrappedKey,
    rawKeyBase64,
    ttlMinutes,
    recipientAddress,
    recipientEnvelope,
    vaultId,
    thresholdShares,
    parentFileId,
    maxDownloads,
  } = body as {
    title?: string;
    description?: string;
    cid: string;
    fileName?: string;
    mime?: string;
    sizeBytes?: number;
    iv: string; // base64
    salt?: string; // base64
    ivWrap?: string; // base64
    wrappedKey?: string; // base64
    rawKeyBase64?: string; // base64
    ttlMinutes?: number;
    recipientAddress?: string;
    recipientEnvelope?: unknown;
    vaultId?: string;
    thresholdShares?: unknown;
    parentFileId?: string;
    maxDownloads?: number | null;
  };
  // Basic input validation
  if (!cid || !iv) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  const titleTrim = (title ?? '').trim();
  if (titleTrim.length > 200) return NextResponse.json({ error: 'Title too long' }, { status: 400 });
  if (fileName && fileName.length > 255) return NextResponse.json({ error: 'File name too long' }, { status: 400 });
  if (typeof sizeBytes === 'number' && sizeBytes > 50 * 1024 * 1024) {
    return NextResponse.json({ error: 'File too large' }, { status: 413 });
  }
  function b64ToBuf(b?: string) {
    if (!b) return null;
    try {
      return Buffer.from(b, 'base64');
    } catch {
      return null;
    }
  }
  const ivBuf = b64ToBuf(iv);
  if (!ivBuf || ivBuf.length !== 12) return NextResponse.json({ error: 'Invalid IV' }, { status: 400 });
  const saltBuf = b64ToBuf(salt);
  if (salt && (!saltBuf || saltBuf.length !== 16)) return NextResponse.json({ error: 'Invalid salt' }, { status: 400 });
  const ivWrapBuf = b64ToBuf(ivWrap);
  if (ivWrap && (!ivWrapBuf || ivWrapBuf.length !== 12)) return NextResponse.json({ error: 'Invalid IV wrap' }, { status: 400 });
  const wrappedKeyBuf = b64ToBuf(wrappedKey);
  const rawKeyBuf = b64ToBuf(rawKeyBase64);
  const hasRecipientEnvelope = typeof recipientAddress === 'string' && isRecipientKeyEnvelope(recipientEnvelope);

  const allowRaw = process.env.ALLOW_RAW_KEYS === 'true' || process.env.NODE_ENV !== 'production';
  const hasWrapped = Boolean(saltBuf && ivWrapBuf && wrappedKeyBuf);
  const hasRaw = Boolean(rawKeyBuf);
  const hasThresholdShares = Array.isArray(thresholdShares) && thresholdShares.length > 0 &&
    thresholdShares.every(isThresholdShareEnvelope);
  if (!hasWrapped && !hasRaw && !hasRecipientEnvelope && !hasThresholdShares) {
    return NextResponse.json({ error: 'Missing key material' }, { status: 400 });
  }
  if (hasThresholdShares && (hasWrapped || hasRaw || hasRecipientEnvelope)) {
    return NextResponse.json({ error: 'Threshold protection cannot be combined with another key mode' }, { status: 400 });
  }
  const normalizedMaxDownloads = maxDownloads == null ? null : Math.floor(maxDownloads);
  if (normalizedMaxDownloads !== null && (!Number.isFinite(normalizedMaxDownloads) || normalizedMaxDownloads < 1 || normalizedMaxDownloads > 10000)) {
    return NextResponse.json({ error: 'Max downloads must be between 1 and 10000' }, { status: 400 });
  }
  if (hasThresholdShares && normalizedMaxDownloads !== null) {
    return NextResponse.json({ error: 'Self-destruct is not yet supported for threshold-protected files' }, { status: 400 });
  }
  if (hasRaw && !allowRaw) return NextResponse.json({ error: 'Raw key not allowed' }, { status: 400 });
  if ((recipientAddress || recipientEnvelope) && !hasRecipientEnvelope) {
    return NextResponse.json({ error: 'Invalid recipient envelope' }, { status: 400 });
  }

  const db = getDb();
  let logicalFileId: string = randomUUID();
  let versionNumber = 1;
  let effectiveVaultId = vaultId ?? null;
  if (parentFileId) {
    if (!canManageFile(db, parentFileId, address)) {
      return NextResponse.json({ error: 'Parent file not found or forbidden' }, { status: 404 });
    }
    const parent = db.prepare(
      'SELECT logical_file_id, vault_id FROM files WHERE id = ?'
    ).get(parentFileId) as { logical_file_id: string | null; vault_id: string | null };
    logicalFileId = parent.logical_file_id || parentFileId;
    effectiveVaultId = parent.vault_id;
    if ((vaultId ?? null) !== effectiveVaultId) {
      return NextResponse.json({ error: 'A new version must remain in the same destination' }, { status: 400 });
    }
  }
  if (effectiveVaultId && !canWriteVault(getVaultRole(db, effectiveVaultId, address))) {
    return NextResponse.json({ error: 'Vault write access required' }, { status: 403 });
  }
  let validatedThresholdShares: ThresholdShareEnvelope[] = [];
  let fileThreshold: { threshold: number; total_shares: number } | null = null;
  if (hasThresholdShares) {
    if (!effectiveVaultId) return NextResponse.json({ error: 'Threshold shares require a vault' }, { status: 400 });
    const policy = db.prepare(
      'SELECT threshold, total_shares FROM vault_threshold_policies WHERE vault_id = ? AND enabled = 1'
    ).get(effectiveVaultId) as { threshold: number; total_shares: number } | undefined;
    if (!policy) return NextResponse.json({ error: 'Vault threshold policy is not enabled' }, { status: 400 });
    fileThreshold = policy;
    validatedThresholdShares = thresholdShares as ThresholdShareEnvelope[];
    const memberRows = db.prepare(
      'SELECT address FROM vault_members WHERE vault_id = ? ORDER BY created_at'
    ).all(effectiveVaultId) as Array<{ address: string }>;
    const expected = new Set(memberRows.map((member) => member.address));
    const received = new Set(validatedThresholdShares.map((share) => normalizeAddress(share.memberAddress)));
    const indices = new Set(validatedThresholdShares.map((share) => share.shareIndex));
    if (validatedThresholdShares.length !== policy.total_shares || received.size !== expected.size ||
        indices.size !== policy.total_shares || [...indices].some((index) => index < 1 || index > policy.total_shares) ||
        [...expected].some((member) => !received.has(member))) {
      return NextResponse.json({ error: 'Threshold shares must cover every vault member' }, { status: 400 });
    }
  }
  const normalizedRecipient = hasRecipientEnvelope ? normalizeAddress(recipientAddress) : null;
  if (normalizedRecipient && !/^0x[a-f0-9]{40}$/.test(normalizedRecipient)) {
    return NextResponse.json({ error: 'Invalid recipient address' }, { status: 400 });
  }
  if (normalizedRecipient) {
    const identity = db.prepare('SELECT address FROM encryption_identities WHERE address = ?').get(normalizedRecipient);
    if (!identity) return NextResponse.json({ error: 'Recipient has no encryption identity' }, { status: 400 });
  }
  const fileId = randomUUID();
  const token = randomUUID();
  const ttlMs = (typeof ttlMinutes === 'number' && ttlMinutes > 0 ? ttlMinutes : 24 * 60) * 60 * 1000;
  const expiresAt = new Date(Date.now() + ttlMs).toISOString();
  const saveFile = db.transaction(() => {
    if (parentFileId) {
      versionNumber = (db.prepare(
        'SELECT COALESCE(MAX(version_number), 0) + 1 AS next_version FROM files WHERE logical_file_id = ?'
      ).get(logicalFileId) as { next_version: number }).next_version;
    }
    db.prepare(
      `INSERT INTO files (id, owner_address, title, description, cid, name, mime, size_bytes, iv, salt, iv_wrap, wrapped_key, raw_key_base64, vault_id, logical_file_id, version_number, max_downloads)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      fileId, address, titleTrim || null, description ?? null, cid, fileName ?? null,
      mime ?? null, sizeBytes ?? null, ivBuf, saltBuf, ivWrapBuf, wrappedKeyBuf, rawKeyBase64 ?? null,
      effectiveVaultId, logicalFileId, versionNumber, normalizedMaxDownloads
    );
    db.prepare(
      `INSERT INTO tokens (token, file_id, issued_to_address, expires_at, revoked)
       VALUES (?, ?, ?, ?, 0)`
    ).run(token, fileId, normalizedRecipient, expiresAt);
    if (normalizedRecipient && recipientEnvelope && isRecipientKeyEnvelope(recipientEnvelope)) {
      db.prepare(
        `INSERT INTO key_envelopes
         (token, recipient_address, algorithm, ephemeral_public_key_jwk, salt, iv, wrapped_key)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(
        token,
        normalizedRecipient,
        recipientEnvelope.algorithm,
        JSON.stringify(recipientEnvelope.ephemeralPublicKey),
        Buffer.from(recipientEnvelope.salt, 'base64'),
        Buffer.from(recipientEnvelope.iv, 'base64'),
        Buffer.from(recipientEnvelope.wrappedKey, 'base64')
      );
    }
    for (const share of validatedThresholdShares) {
      db.prepare(
        `INSERT INTO threshold_file_shares
         (file_id, member_address, share_index, algorithm, ephemeral_public_key_jwk, salt, iv, wrapped_share)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        fileId,
        normalizeAddress(share.memberAddress),
        share.shareIndex,
        share.envelope.algorithm,
        JSON.stringify(share.envelope.ephemeralPublicKey),
        Buffer.from(share.envelope.salt, 'base64'),
        Buffer.from(share.envelope.iv, 'base64'),
        Buffer.from(share.envelope.wrappedKey, 'base64')
      );
    }
    if (fileThreshold) {
      db.prepare(
        'INSERT INTO threshold_files (file_id, threshold, total_shares) VALUES (?, ?, ?)'
      ).run(fileId, fileThreshold.threshold, fileThreshold.total_shares);
    }
    recordAudit(db, {
      actorAddress: address,
      action: parentFileId ? 'file.version_created' : 'file.created',
      resourceType: 'file',
      resourceId: fileId,
      metadata: { logicalFileId, versionNumber, vaultId: effectiveVaultId, maxDownloads: normalizedMaxDownloads },
    });
  });
  saveFile();

  return NextResponse.json({ fileId, token, logicalFileId, versionNumber });
}
