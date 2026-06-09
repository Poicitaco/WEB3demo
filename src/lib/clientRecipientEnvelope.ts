"use client";

import type { EncryptionPublicJwk } from '@/lib/encryptionIdentity';
import {
  RECIPIENT_ENVELOPE_ALGORITHM,
  RECIPIENT_ENVELOPE_INFO,
  type RecipientKeyEnvelope,
} from '@/lib/recipientEnvelope';

function bufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function deriveEnvelopeKey(privateKey: CryptoKey, publicKey: CryptoKey, salt: Uint8Array) {
  const sharedSecret = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: publicKey },
    privateKey,
    256
  );
  const hkdfKey = await crypto.subtle.importKey('raw', sharedSecret, 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: salt.buffer as ArrayBuffer,
      info: new TextEncoder().encode(RECIPIENT_ENVELOPE_INFO).buffer as ArrayBuffer,
    },
    hkdfKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function wrapFileKeyForRecipient(
  rawFileKey: ArrayBuffer,
  recipientPublicKey: EncryptionPublicJwk
): Promise<RecipientKeyEnvelope> {
  const recipientKey = await crypto.subtle.importKey(
    'jwk',
    recipientPublicKey,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );
  const ephemeral = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits']
  );
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const wrappingKey = await deriveEnvelopeKey(ephemeral.privateKey, recipientKey, salt);
  const wrappedKey = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
    wrappingKey,
    rawFileKey
  );
  const ephemeralPublicKey = await crypto.subtle.exportKey('jwk', ephemeral.publicKey) as EncryptionPublicJwk;

  return {
    algorithm: RECIPIENT_ENVELOPE_ALGORITHM,
    ephemeralPublicKey,
    salt: bufferToBase64(salt.buffer),
    iv: bufferToBase64(iv.buffer),
    wrappedKey: bufferToBase64(wrappedKey),
  };
}

export async function unwrapFileKeyFromRecipientEnvelope(
  envelope: RecipientKeyEnvelope,
  recipientPrivateKey: CryptoKey
) {
  const ephemeralPublicKey = await crypto.subtle.importKey(
    'jwk',
    envelope.ephemeralPublicKey,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );
  const salt = base64ToBytes(envelope.salt);
  const iv = base64ToBytes(envelope.iv);
  const wrappingKey = await deriveEnvelopeKey(recipientPrivateKey, ephemeralPublicKey, salt);
  return crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
    wrappingKey,
    base64ToBytes(envelope.wrappedKey).buffer as ArrayBuffer
  );
}
