import { NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { getSessionAddress } from '@/lib/auth';
import { verifyCsrf } from '@/lib/csrf';
import { getDb } from '@/lib/db';
import {
  ENCRYPTION_IDENTITY_ALGORITHM,
  encryptionIdentityMessage,
  isEncryptionPublicJwk,
  normalizeAddress,
} from '@/lib/encryptionIdentity';
import { recordAudit } from '@/lib/audit';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const sessionAddress = await getSessionAddress();
  if (!sessionAddress) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  if (!(await verifyCsrf(req))) return NextResponse.json({ ok: false, error: 'CSRF' }, { status: 403 });

  const body = await req.json().catch(() => ({})) as { publicKey?: unknown; signature?: unknown };
  if (!isEncryptionPublicJwk(body.publicKey) || typeof body.signature !== 'string') {
    return NextResponse.json({ ok: false, error: 'Invalid identity payload' }, { status: 400 });
  }
  try {
    await crypto.subtle.importKey(
      'jwk',
      body.publicKey,
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      []
    );
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid P-256 public key' }, { status: 400 });
  }

  const address = normalizeAddress(sessionAddress);
  let recovered: string;
  try {
    recovered = ethers.verifyMessage(
      encryptionIdentityMessage(address, body.publicKey),
      body.signature
    );
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid wallet signature' }, { status: 400 });
  }
  if (normalizeAddress(recovered) !== address) {
    return NextResponse.json({ ok: false, error: 'Wallet signature does not match session' }, { status: 403 });
  }

  const db = getDb();
  db.transaction(() => {
    db.prepare(
      `INSERT INTO encryption_identities (address, algorithm, public_key_jwk, wallet_signature)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(address) DO UPDATE SET
         algorithm = excluded.algorithm,
         public_key_jwk = excluded.public_key_jwk,
         wallet_signature = excluded.wallet_signature,
         updated_at = CURRENT_TIMESTAMP`
    ).run(address, ENCRYPTION_IDENTITY_ALGORITHM, JSON.stringify(body.publicKey), body.signature);
    recordAudit(db, { actorAddress: address, action: 'identity.registered', resourceType: 'identity', resourceId: address });
  })();

  return NextResponse.json({ ok: true, address, algorithm: ENCRYPTION_IDENTITY_ALGORITHM });
}
