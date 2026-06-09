import { test, expect, request } from '@playwright/test';
import { ethers } from 'ethers';
import { webcrypto } from 'node:crypto';
import {
  type EncryptionPublicJwk,
  encryptionIdentityMessage,
} from '../src/lib/encryptionIdentity';

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

