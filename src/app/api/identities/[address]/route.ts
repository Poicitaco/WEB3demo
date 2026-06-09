import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import {
  ENCRYPTION_IDENTITY_ALGORITHM,
  isEncryptionPublicJwk,
  normalizeAddress,
} from '@/lib/encryptionIdentity';

export const runtime = 'nodejs';

export async function GET(_req: Request, context: { params: Promise<{ address: string }> }) {
  const { address } = await context.params;
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return NextResponse.json({ ok: false, error: 'Invalid address' }, { status: 400 });
  }
  const row = getDb().prepare(
    `SELECT address, algorithm, public_key_jwk, updated_at
     FROM encryption_identities WHERE address = ?`
  ).get(normalizeAddress(address)) as {
    address: string;
    algorithm: string;
    public_key_jwk: string;
    updated_at: string;
  } | undefined;

  if (!row) return NextResponse.json({ ok: false, error: 'Identity not found' }, { status: 404 });
  let publicKey: unknown;
  try {
    publicKey = JSON.parse(row.public_key_jwk) as unknown;
  } catch {
    return NextResponse.json({ ok: false, error: 'Stored identity is invalid' }, { status: 500 });
  }
  if (row.algorithm !== ENCRYPTION_IDENTITY_ALGORITHM || !isEncryptionPublicJwk(publicKey)) {
    return NextResponse.json({ ok: false, error: 'Stored identity is invalid' }, { status: 500 });
  }
  return NextResponse.json({
    ok: true,
    identity: {
      address: row.address,
      algorithm: row.algorithm,
      publicKey,
      updatedAt: row.updated_at,
    },
  });
}
