"use client";

import * as secrets from 'secrets.js-grempe';
import type { EncryptionPublicJwk } from '@/lib/encryptionIdentity';
import type { RecipientSecretEnvelope } from '@/lib/recipientEnvelope';
import {
  unwrapSecretFromRecipientEnvelope,
  wrapSecretForRecipient,
} from '@/lib/clientRecipientEnvelope';

export type EncryptedThresholdShare = {
  recipientAddress: string;
  shareIndex: number;
  envelope: RecipientSecretEnvelope;
};

function arrayBufferToHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function hexToArrayBuffer(hex: string) {
  if (!/^[a-fA-F0-9]+$/.test(hex) || hex.length % 2 !== 0) throw new Error('Invalid recovered secret');
  return Uint8Array.from(hex.match(/.{2}/g) ?? [], (byte) => parseInt(byte, 16)).buffer;
}

export function splitSecret(secret: ArrayBuffer, totalShares: number, threshold: number) {
  if (!Number.isInteger(totalShares) || !Number.isInteger(threshold) || threshold < 2 || totalShares < threshold || totalShares > 255) {
    throw new Error('Invalid threshold policy');
  }
  secrets.init(8, 'browserCryptoGetRandomValues');
  return secrets.share(arrayBufferToHex(secret), totalShares, threshold);
}

export function combineSecret(shares: string[]) {
  if (shares.length < 2) throw new Error('At least two shares are required');
  return hexToArrayBuffer(secrets.combine(shares));
}

export async function encryptThresholdShares(
  shares: string[],
  recipients: Array<{ address: string; publicKey: EncryptionPublicJwk }>
) {
  if (shares.length !== recipients.length) throw new Error('Every share requires one recipient');
  return Promise.all(recipients.map(async (recipient, index) => ({
    recipientAddress: recipient.address.toLowerCase(),
    shareIndex: index + 1,
    envelope: await wrapSecretForRecipient(
      new TextEncoder().encode(shares[index]).buffer as ArrayBuffer,
      recipient.publicKey
    ),
  })));
}

export async function decryptThresholdShare(envelope: RecipientSecretEnvelope, privateKey: CryptoKey) {
  const share = await unwrapSecretFromRecipientEnvelope(envelope, privateKey);
  return new TextDecoder().decode(share);
}
