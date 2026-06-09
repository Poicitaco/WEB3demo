import { test, expect, request } from '@playwright/test';
import { ethers } from 'ethers';
import { webcrypto } from 'node:crypto';
import {
  type EncryptionPublicJwk,
  encryptionIdentityMessage,
} from '../src/lib/encryptionIdentity';
import {
  RECIPIENT_ENVELOPE_ALGORITHM,
  type RecipientKeyEnvelope,
} from '../src/lib/recipientEnvelope';
import {
  unwrapFileKeyFromRecipientEnvelope,
  wrapFileKeyForRecipient,
} from '../src/lib/clientRecipientEnvelope';
import {
  combineSecret,
  decryptThresholdShare,
  encryptThresholdShares,
  splitSecret,
} from '../src/lib/clientThresholdShares';

async function loginSession(baseURL: string) {
  const req = await request.newContext({ baseURL });
  const start = await req.post('/api/auth/start');
  const { message } = await start.json();
  const wallet = ethers.Wallet.createRandom();
  const signature = await wallet.signMessage(message);
  const verify = await req.post('/api/auth/verify', {
    data: { address: wallet.address, signature },
  });
  // Extract session cookie
  const setCookie = verify.headers()['set-cookie'] || '';
  const m = setCookie.match(/session=([^;]+)/);
  if (!m) throw new Error('No session cookie');
  return decodeURIComponent(m[1]);
}

async function authenticatedRequest(baseURL: string) {
  const req = await request.newContext({ baseURL });
  const wallet = ethers.Wallet.createRandom();
  const start = await req.post('/api/auth/start');
  const { message } = await start.json();
  const signature = await wallet.signMessage(message);
  const verify = await req.post('/api/auth/verify', {
    data: { address: wallet.address, signature },
  });
  expect(verify.ok()).toBeTruthy();
  return { req, wallet };
}

async function csrfFor(req: Awaited<ReturnType<typeof request.newContext>>) {
  const response = await req.get('/api/csrf');
  return (await response.json()).csrf as string;
}

async function registerEncryptionIdentity(
  req: Awaited<ReturnType<typeof request.newContext>>,
  wallet: ethers.Wallet
) {
  const pair = await webcrypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey', 'deriveBits']
  );
  const publicKey = JSON.parse(
    JSON.stringify(await webcrypto.subtle.exportKey('jwk', pair.publicKey))
  ) as EncryptionPublicJwk;
  const signature = await wallet.signMessage(encryptionIdentityMessage(wallet.address, publicKey));
  const register = await req.post('/api/identities', {
    headers: { 'x-csrf': await csrfFor(req) },
    data: { publicKey, signature },
  });
  expect(register.ok()).toBeTruthy();
  return publicKey;
}

test.describe('Encryption identity API', () => {
  test('registers a wallet-signed P-256 public key', async ({ baseURL }) => {
    if (!baseURL) test.skip();
    const { req, wallet } = await authenticatedRequest(baseURL);
    const csrfResponse = await req.get('/api/csrf');
    const { csrf } = await csrfResponse.json();
    const pair = await webcrypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveKey', 'deriveBits']
    );
    const publicKey = JSON.parse(
      JSON.stringify(await webcrypto.subtle.exportKey('jwk', pair.publicKey))
    ) as EncryptionPublicJwk;
    const signature = await wallet.signMessage(encryptionIdentityMessage(wallet.address, publicKey));

    const register = await req.post('/api/identities', {
      headers: { 'x-csrf': csrf },
      data: { publicKey, signature },
    });
    expect(register.ok()).toBeTruthy();

    const lookup = await req.get(`/api/identities/${wallet.address}`);
    expect(lookup.ok()).toBeTruthy();
    const body = await lookup.json();
    expect(body.identity.address).toBe(wallet.address.toLowerCase());
    expect(body.identity.publicKey).toEqual(publicKey);
    await req.dispose();
  });

  test('rejects a public key signed by another wallet', async ({ baseURL }) => {
    if (!baseURL) test.skip();
    const { req } = await authenticatedRequest(baseURL);
    const csrfResponse = await req.get('/api/csrf');
    const { csrf } = await csrfResponse.json();
    const pair = await webcrypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveKey', 'deriveBits']
    );
    const publicKey = JSON.parse(
      JSON.stringify(await webcrypto.subtle.exportKey('jwk', pair.publicKey))
    ) as EncryptionPublicJwk;
    const signature = await ethers.Wallet.createRandom().signMessage(
      encryptionIdentityMessage(ethers.Wallet.createRandom().address, publicKey)
    );

    const register = await req.post('/api/identities', {
      headers: { 'x-csrf': csrf },
      data: { publicKey, signature },
    });
    expect(register.status()).toBe(403);
    await req.dispose();
  });
});

test.describe('Recipient-restricted E2EE sharing', () => {
  test('wraps and unwraps the same AES file key', async () => {
    const recipient = await webcrypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveBits']
    );
    const publicKey = JSON.parse(
      JSON.stringify(await webcrypto.subtle.exportKey('jwk', recipient.publicKey))
    ) as EncryptionPublicJwk;
    const rawFileKey = webcrypto.getRandomValues(new Uint8Array(32)).buffer;

    const envelope = await wrapFileKeyForRecipient(rawFileKey, publicKey);
    const unwrapped = await unwrapFileKeyFromRecipientEnvelope(envelope, recipient.privateKey);

    expect(Buffer.from(unwrapped)).toEqual(Buffer.from(rawFileKey));
  });

  test('only returns the key envelope to the recipient wallet session', async ({ baseURL }) => {
    if (!baseURL) test.skip();
    const owner = await authenticatedRequest(baseURL);
    const recipient = await authenticatedRequest(baseURL);
    const recipientPublicKey = await registerEncryptionIdentity(recipient.req, recipient.wallet);
    const ephemeral = await webcrypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveBits']
    );
    const ephemeralPublicKey = JSON.parse(
      JSON.stringify(await webcrypto.subtle.exportKey('jwk', ephemeral.publicKey))
    ) as EncryptionPublicJwk;
    const envelope: RecipientKeyEnvelope = {
      algorithm: RECIPIENT_ENVELOPE_ALGORITHM,
      ephemeralPublicKey,
      salt: Buffer.alloc(16, 1).toString('base64'),
      iv: Buffer.alloc(12, 2).toString('base64'),
      wrappedKey: Buffer.alloc(48, 3).toString('base64'),
    };
    expect(recipientPublicKey.crv).toBe('P-256');

    const create = await owner.req.post('/api/files', {
      headers: { 'x-csrf': await csrfFor(owner.req) },
      data: {
        title: 'Recipient only',
        cid: 'recipient-e2ee-test-cid',
        fileName: 'recipient.txt',
        mime: 'text/plain',
        sizeBytes: 12,
        iv: Buffer.alloc(12, 4).toString('base64'),
        recipientAddress: recipient.wallet.address,
        recipientEnvelope: envelope,
      },
    });
    expect(create.ok()).toBeTruthy();
    const { token } = await create.json();

    const ownerValidation = await owner.req.post('/api/tokens/validate', { data: { token } });
    expect(ownerValidation.status()).toBe(403);

    const anonymous = await request.newContext({ baseURL });
    const anonymousValidation = await anonymous.post('/api/tokens/validate', { data: { token } });
    expect(anonymousValidation.status()).toBe(403);

    const recipientValidation = await recipient.req.post('/api/tokens/validate', { data: { token } });
    expect(recipientValidation.ok()).toBeTruthy();
    const body = await recipientValidation.json();
    expect(body.recipientAddress).toBe(recipient.wallet.address.toLowerCase());
    expect(body.recipientEnvelope).toEqual(envelope);

    await anonymous.dispose();
    await owner.req.dispose();
    await recipient.req.dispose();
  });
});

test.describe('Collaborative vault access control', () => {
  test('enforces owner, editor, and viewer permissions', async ({ baseURL }) => {
    if (!baseURL) test.skip();
    const owner = await authenticatedRequest(baseURL);
    const editor = await authenticatedRequest(baseURL);
    const viewer = await authenticatedRequest(baseURL);

    const createVault = await owner.req.post('/api/vaults', {
      headers: { 'x-csrf': await csrfFor(owner.req) },
      data: { name: 'Security Team Vault', description: 'Role matrix test' },
    });
    expect(createVault.ok()).toBeTruthy();
    const { vaultId } = await createVault.json();

    for (const [memberAddress, role] of [
      [editor.wallet.address, 'editor'],
      [viewer.wallet.address, 'viewer'],
    ]) {
      const addMember = await owner.req.post(`/api/vaults/${vaultId}/members`, {
        headers: { 'x-csrf': await csrfFor(owner.req) },
        data: { memberAddress, role },
      });
      expect(addMember.ok()).toBeTruthy();
    }

    const editorManageAttempt = await editor.req.post(`/api/vaults/${vaultId}/members`, {
      headers: { 'x-csrf': await csrfFor(editor.req) },
      data: { memberAddress: ethers.Wallet.createRandom().address, role: 'viewer' },
    });
    expect(editorManageAttempt.status()).toBe(403);
    const ownerRoleChange = await owner.req.post(`/api/vaults/${vaultId}/members`, {
      headers: { 'x-csrf': await csrfFor(owner.req) },
      data: { memberAddress: owner.wallet.address, role: 'viewer' },
    });
    expect(ownerRoleChange.status()).toBe(400);

    const createFile = await editor.req.post('/api/files', {
      headers: { 'x-csrf': await csrfFor(editor.req) },
      data: {
        title: 'Vault document',
        cid: 'vault-role-test-cid',
        fileName: 'vault.txt',
        mime: 'text/plain',
        sizeBytes: 10,
        iv: Buffer.alloc(12, 5).toString('base64'),
        rawKeyBase64: Buffer.alloc(32, 6).toString('base64'),
        vaultId,
      },
    });
    expect(createFile.ok()).toBeTruthy();
    const { fileId } = await createFile.json();

    const viewerFiles = await viewer.req.get('/api/files/list');
    expect(viewerFiles.ok()).toBeTruthy();
    const viewerFileBody = await viewerFiles.json();
    expect(viewerFileBody.files.some((file: { id: string }) => file.id === fileId)).toBeTruthy();

    const viewerUpload = await viewer.req.post('/api/files', {
      headers: { 'x-csrf': await csrfFor(viewer.req) },
      data: {
        title: 'Forbidden upload',
        cid: 'forbidden-vault-cid',
        fileName: 'forbidden.txt',
        mime: 'text/plain',
        sizeBytes: 10,
        iv: Buffer.alloc(12, 7).toString('base64'),
        rawKeyBase64: Buffer.alloc(32, 8).toString('base64'),
        vaultId,
      },
    });
    expect(viewerUpload.status()).toBe(403);

    const editorToken = await editor.req.post('/api/tokens/issue', {
      headers: { 'x-csrf': await csrfFor(editor.req) },
      data: { fileId, ttlMinutes: 60 },
    });
    expect(editorToken.ok()).toBeTruthy();

    const viewerToken = await viewer.req.post('/api/tokens/issue', {
      headers: { 'x-csrf': await csrfFor(viewer.req) },
      data: { fileId, ttlMinutes: 60 },
    });
    expect(viewerToken.status()).toBe(404);

    const removeEditor = await owner.req.delete(`/api/vaults/${vaultId}/members`, {
      headers: { 'x-csrf': await csrfFor(owner.req) },
      data: { memberAddress: editor.wallet.address },
    });
    expect(removeEditor.ok()).toBeTruthy();
    const removedEditorFiles = await editor.req.get('/api/files/list');
    const removedEditorFileBody = await removedEditorFiles.json();
    expect(removedEditorFileBody.files.some((file: { id: string }) => file.id === fileId)).toBeFalsy();
    const removedEditorToken = await editor.req.post('/api/tokens/issue', {
      headers: { 'x-csrf': await csrfFor(editor.req) },
      data: { fileId, ttlMinutes: 60 },
    });
    expect(removedEditorToken.status()).toBe(404);

    await owner.req.dispose();
    await editor.req.dispose();
    await viewer.req.dispose();
  });
});

test.describe('Shamir threshold policy foundation', () => {
  test('recovers a secret from K encrypted member shares', async () => {
    const secret = webcrypto.getRandomValues(new Uint8Array(32)).buffer;
    const shares = splitSecret(secret, 5, 3);
    expect(Buffer.from(combineSecret(shares.slice(0, 2)))).not.toEqual(Buffer.from(secret));
    const recipients = await Promise.all(Array.from({ length: 5 }, async (_, index) => {
      const pair = await webcrypto.subtle.generateKey(
        { name: 'ECDH', namedCurve: 'P-256' },
        true,
        ['deriveBits']
      );
      const publicKey = JSON.parse(
        JSON.stringify(await webcrypto.subtle.exportKey('jwk', pair.publicKey))
      ) as EncryptionPublicJwk;
      return { address: ethers.Wallet.createRandom().address, publicKey, privateKey: pair.privateKey, index };
    }));
    const encrypted = await encryptThresholdShares(shares, recipients);
    const approvedShares = await Promise.all(
      encrypted.slice(0, 3).map((share, index) => decryptThresholdShare(share.envelope, recipients[index].privateKey))
    );
    expect(Buffer.from(combineSecret(approvedShares))).toEqual(Buffer.from(secret));
  });

  test('only owner configures policy and membership changes invalidate it', async ({ baseURL }) => {
    if (!baseURL) test.skip();
    const owner = await authenticatedRequest(baseURL);
    const editor = await authenticatedRequest(baseURL);
    await registerEncryptionIdentity(owner.req, owner.wallet);
    await registerEncryptionIdentity(editor.req, editor.wallet);

    const createVault = await owner.req.post('/api/vaults', {
      headers: { 'x-csrf': await csrfFor(owner.req) },
      data: { name: 'Threshold Vault' },
    });
    const { vaultId } = await createVault.json();
    const addEditor = await owner.req.post(`/api/vaults/${vaultId}/members`, {
      headers: { 'x-csrf': await csrfFor(owner.req) },
      data: { memberAddress: editor.wallet.address, role: 'editor' },
    });
    expect(addEditor.ok()).toBeTruthy();

    const editorPolicy = await editor.req.put(`/api/vaults/${vaultId}/threshold`, {
      headers: { 'x-csrf': await csrfFor(editor.req) },
      data: { threshold: 2 },
    });
    expect(editorPolicy.status()).toBe(403);

    const ownerPolicy = await owner.req.put(`/api/vaults/${vaultId}/threshold`, {
      headers: { 'x-csrf': await csrfFor(owner.req) },
      data: { threshold: 2 },
    });
    expect(ownerPolicy.ok()).toBeTruthy();
    const memberList = await owner.req.get(`/api/vaults/${vaultId}/members`);
    const memberListBody = await memberList.json();
    expect(memberListBody.members.every((member: { encryptionIdentity: unknown }) => member.encryptionIdentity)).toBeTruthy();

    const memberWithoutIdentity = ethers.Wallet.createRandom();
    const addViewer = await owner.req.post(`/api/vaults/${vaultId}/members`, {
      headers: { 'x-csrf': await csrfFor(owner.req) },
      data: { memberAddress: memberWithoutIdentity.address, role: 'viewer' },
    });
    expect(addViewer.ok()).toBeTruthy();
    const invalidated = await owner.req.get(`/api/vaults/${vaultId}/threshold`);
    expect((await invalidated.json()).policy).toBeNull();

    const policyWithMissingIdentity = await owner.req.put(`/api/vaults/${vaultId}/threshold`, {
      headers: { 'x-csrf': await csrfFor(owner.req) },
      data: { threshold: 2 },
    });
    expect(policyWithMissingIdentity.status()).toBe(400);

    await owner.req.dispose();
    await editor.req.dispose();
  });
});

test.describe('Upload/Download - passphrase flow', () => {
  test('encrypt, upload, save metadata, download & decrypt', async ({ page, context, baseURL }) => {
    if (!baseURL) test.skip();
    const session = await loginSession(baseURL);
    await context.addCookies([{ name: 'session', value: session, domain: 'localhost', path: '/' }]);

    await page.goto('/upload');
    await page.locator('input[type="file"]').setInputFiles({
      name: 'hello.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('Hello secure world'),
    });
    await page.getByPlaceholder('My encrypted document').fill('Playwright Test');
    await page.locator('input[type="password"]').fill('pass1234-Strong');
    await page.getByRole('button', { name: 'Encrypt & Upload' }).click();
    await page.getByText('Share token').waitFor();
    await page.getByRole('link', { name: 'Open download' }).click();
    await page.getByRole('button', { name: 'Validate' }).click();
    await page.getByText('Ready').waitFor();
    await page.locator('input[type="password"]').fill('pass1234-Strong');
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /Download & Decrypt/ }).click();
    const download = await downloadPromise;
    const path = await download.path();
    expect(path).toBeTruthy();
    expect(download.suggestedFilename()).toContain('hello.txt');
  });
});

test.describe('Upload/Download - demo raw key flow', () => {
  test('skipped unless NEXT_PUBLIC_ALLOW_DEMO_RAW_KEYS=true', async ({ page, context, baseURL }) => {
    if (process.env.NEXT_PUBLIC_ALLOW_DEMO_RAW_KEYS !== 'true') test.skip();
    if (!baseURL) test.skip();
    const session = await loginSession(baseURL);
    await context.addCookies([{ name: 'session', value: session, domain: 'localhost', path: '/' }]);

    await page.goto('/upload');
    await page.locator('input[type="file"]').setInputFiles({
      name: 'demo.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('Raw key demo'),
    });
    await page.getByPlaceholder('My encrypted document').fill('Demo File');
    await page.getByRole('button', { name: 'Encrypt & Upload' }).click();
    await page.getByText('Share token').waitFor();
    await page.getByRole('link', { name: 'Open download' }).click();
    await page.getByRole('button', { name: 'Validate' }).click();
    await page.getByText('Ready').waitFor();
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /Download & Decrypt/ }).click();
    const download = await downloadPromise;
    const path = await download.path();
    expect(path).toBeTruthy();
    expect(download.suggestedFilename()).toContain('demo.txt');
  });
});

