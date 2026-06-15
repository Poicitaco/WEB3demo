import { NextResponse } from 'next/server';
import { getSessionAddress } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { normalizeAddress } from '@/lib/encryptionIdentity';
import { getVaultRole } from '@/lib/vaultAccess';

export const runtime = 'nodejs';

function envelopeFromRow(row: {
  algorithm: string;
  ephemeral_public_key_jwk: string;
  salt: Buffer;
  iv: Buffer;
  wrapped_share: Buffer;
}) {
  return {
    algorithm: row.algorithm,
    ephemeralPublicKey: JSON.parse(row.ephemeral_public_key_jwk),
    salt: row.salt.toString('base64'),
    iv: row.iv.toString('base64'),
    wrappedKey: row.wrapped_share.toString('base64'),
  };
}

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const address = await getSessionAddress();
  if (!address) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  const { id } = await context.params;
  const normalized = normalizeAddress(address);
  const db = getDb();
  const request = db.prepare(
    `SELECT r.id, r.file_id, r.requester_address, r.threshold, r.status, r.expires_at,
            f.title, f.name, f.mime, f.size_bytes, f.cid, f.iv, f.vault_id
     FROM approval_requests r JOIN files f ON f.id = r.file_id WHERE r.id = ?`
  ).get(id) as {
    id: string; file_id: string; requester_address: string; threshold: number; status: string; expires_at: string;
    title: string | null; name: string | null; mime: string | null; size_bytes: number | null; cid: string; iv: Buffer; vault_id: string;
  } | undefined;
  if (!request) return NextResponse.json({ ok: false, error: 'Request not found' }, { status: 404 });
  if (!getVaultRole(db, request.vault_id, normalized)) {
    return NextResponse.json({ ok: false, error: 'No longer a vault member' }, { status: 403 });
  }
  if (new Date(request.expires_at).getTime() < Date.now()) {
    db.prepare(`UPDATE approval_requests SET status = 'expired' WHERE id = ?`).run(id);
    return NextResponse.json({ ok: false, error: 'Request expired' }, { status: 403 });
  }
  if (normalized === request.requester_address) {
    const approvedToken = db.prepare(
      `SELECT token, expires_at FROM tokens
       WHERE approval_request_id = ? AND issued_to_address = ? AND revoked = 0
       ORDER BY created_at DESC LIMIT 1`
    ).get(id, normalized) as { token: string; expires_at: string | null } | undefined;
    const ownShare = db.prepare(
      `SELECT s.share_index, s.algorithm, s.ephemeral_public_key_jwk, s.salt, s.iv, s.wrapped_share,
              i.algorithm AS requester_algorithm, i.public_key_jwk AS requester_public_key_jwk
       FROM threshold_file_shares s
       JOIN encryption_identities i ON i.address = ?
       WHERE s.file_id = ? AND s.member_address = ?`
    ).get(request.requester_address, request.file_id, normalized) as {
      share_index: number; algorithm: string; ephemeral_public_key_jwk: string; salt: Buffer; iv: Buffer; wrapped_share: Buffer;
      requester_algorithm: string; requester_public_key_jwk: string;
    } | undefined;
    const contributions = db.prepare(
      `SELECT approver_address, share_index, algorithm, ephemeral_public_key_jwk, salt, iv, wrapped_share
       FROM approval_contributions WHERE request_id = ? ORDER BY created_at`
    ).all(id) as Array<{
      approver_address: string; share_index: number; algorithm: string; ephemeral_public_key_jwk: string;
      salt: Buffer; iv: Buffer; wrapped_share: Buffer;
    }>;
    return NextResponse.json({
      ok: true,
      request: {
        ...request,
        iv: request.iv.toString('base64'),
        approvalCount: contributions.length,
        shareIndex: ownShare?.share_index,
        encryptedShare: ownShare ? envelopeFromRow(ownShare) : undefined,
        requesterIdentity: ownShare ? {
          algorithm: ownShare.requester_algorithm,
          publicKey: JSON.parse(ownShare.requester_public_key_jwk),
        } : undefined,
        contributions: contributions.map((row) => ({
          approverAddress: row.approver_address,
          shareIndex: row.share_index,
          envelope: envelopeFromRow(row),
        })),
        approvedToken: approvedToken?.token,
        approvedTokenExpiresAt: approvedToken?.expires_at,
      },
    });
  }
  const share = db.prepare(
    `SELECT s.share_index, s.algorithm, s.ephemeral_public_key_jwk, s.salt, s.iv, s.wrapped_share,
            i.algorithm AS requester_algorithm, i.public_key_jwk AS requester_public_key_jwk
     FROM threshold_file_shares s
     JOIN encryption_identities i ON i.address = ?
     WHERE s.file_id = ? AND s.member_address = ?`
  ).get(request.requester_address, request.file_id, normalized) as {
    share_index: number; algorithm: string; ephemeral_public_key_jwk: string; salt: Buffer; iv: Buffer; wrapped_share: Buffer;
    requester_algorithm: string; requester_public_key_jwk: string;
  } | undefined;
  if (!share) return NextResponse.json({ ok: false, error: 'Not an approver for this request' }, { status: 403 });
  return NextResponse.json({
    ok: true,
    request: {
      id: request.id,
      fileId: request.file_id,
      title: request.title,
      requesterAddress: request.requester_address,
      threshold: request.threshold,
      shareIndex: share.share_index,
      encryptedShare: envelopeFromRow(share),
      requesterIdentity: {
        algorithm: share.requester_algorithm,
        publicKey: JSON.parse(share.requester_public_key_jwk),
      },
    },
  });
}
