"use client";

import {
  type EncryptionPublicJwk,
  isEncryptionPublicJwk,
  normalizeAddress,
} from '@/lib/encryptionIdentity';

const DB_NAME = 'secureshare-identity';
const STORE_NAME = 'keys';
const DB_VERSION = 1;

export type LocalEncryptionIdentity = {
  address: string;
  privateKey: CryptoKey;
  publicKey: EncryptionPublicJwk;
  createdAt: string;
};

function openIdentityDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readIdentity(address: string) {
  const db = await openIdentityDb();
  return new Promise<LocalEncryptionIdentity | null>((resolve, reject) => {
    const request = db.transaction(STORE_NAME, 'readonly')
      .objectStore(STORE_NAME)
      .get(normalizeAddress(address));
    request.onsuccess = () => resolve((request.result as LocalEncryptionIdentity | undefined) ?? null);
    request.onerror = () => reject(request.error);
  }).finally(() => db.close());
}

export async function saveLocalEncryptionIdentity(identity: LocalEncryptionIdentity) {
  const db = await openIdentityDb();
  return new Promise<void>((resolve, reject) => {
    const request = db.transaction(STORE_NAME, 'readwrite')
      .objectStore(STORE_NAME)
      .put(identity, identity.address);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  }).finally(() => db.close());
}

export async function getLocalEncryptionIdentity(address: string) {
  return readIdentity(address);
}

export async function generateLocalEncryptionIdentity(address: string) {
  const pair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey', 'deriveBits']
  );
  const privateJwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
  const publicJwk = await crypto.subtle.exportKey('jwk', pair.publicKey);
  if (!isEncryptionPublicJwk(publicJwk)) throw new Error('Browser generated an invalid public key');

  const privateKey = await crypto.subtle.importKey(
    'jwk',
    privateJwk,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    ['deriveKey', 'deriveBits']
  );
  const identity: LocalEncryptionIdentity = {
    address: normalizeAddress(address),
    privateKey,
    publicKey: publicJwk,
    createdAt: new Date().toISOString(),
  };
  return identity;
}

export async function createLocalEncryptionIdentity(address: string) {
  const identity = await generateLocalEncryptionIdentity(address);
  await saveLocalEncryptionIdentity(identity);
  return identity;
}

export async function getOrCreateLocalEncryptionIdentity(address: string) {
  return (await readIdentity(address)) ?? createLocalEncryptionIdentity(address);
}
