import {
  type EncryptionPublicJwk,
  isEncryptionPublicJwk,
} from '@/lib/encryptionIdentity';

export const RECIPIENT_ENVELOPE_ALGORITHM = 'ECDH-P256-HKDF-SHA256-AES256-GCM';
export const RECIPIENT_ENVELOPE_INFO = 'SecureShare file key envelope v1';

export type RecipientKeyEnvelope = {
  algorithm: typeof RECIPIENT_ENVELOPE_ALGORITHM;
  ephemeralPublicKey: EncryptionPublicJwk;
  salt: string;
  iv: string;
  wrappedKey: string;
};

function isBase64WithByteLength(value: unknown, bytes: number) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) return false;
  const padding = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0;
  return Math.floor((value.length * 3) / 4) - padding === bytes;
}

export function isRecipientKeyEnvelope(value: unknown): value is RecipientKeyEnvelope {
  if (!value || typeof value !== 'object') return false;
  const envelope = value as Partial<RecipientKeyEnvelope>;
  return (
    envelope.algorithm === RECIPIENT_ENVELOPE_ALGORITHM &&
    isEncryptionPublicJwk(envelope.ephemeralPublicKey) &&
    isBase64WithByteLength(envelope.salt, 16) &&
    isBase64WithByteLength(envelope.iv, 12) &&
    isBase64WithByteLength(envelope.wrappedKey, 48)
  );
}
