export const ENCRYPTION_IDENTITY_ALGORITHM = 'ECDH-P256';

export type EncryptionPublicJwk = {
  kty: 'EC';
  crv: 'P-256';
  x: string;
  y: string;
};

export function normalizeAddress(address: string) {
  return address.toLowerCase();
}

export function isEncryptionPublicJwk(value: unknown): value is EncryptionPublicJwk {
  if (!value || typeof value !== 'object') return false;
  const jwk = value as Partial<EncryptionPublicJwk>;
  return (
    jwk.kty === 'EC' &&
    jwk.crv === 'P-256' &&
    typeof jwk.x === 'string' &&
    /^[A-Za-z0-9_-]{43}$/.test(jwk.x) &&
    typeof jwk.y === 'string' &&
    /^[A-Za-z0-9_-]{43}$/.test(jwk.y)
  );
}

export function encryptionIdentityMessage(address: string, publicKey: EncryptionPublicJwk) {
  return [
    'SecureShare encryption identity',
    `Address: ${normalizeAddress(address)}`,
    `Algorithm: ${ENCRYPTION_IDENTITY_ALGORITHM}`,
    `Public key: ${publicKey.x}.${publicKey.y}`,
  ].join('\n');
}
