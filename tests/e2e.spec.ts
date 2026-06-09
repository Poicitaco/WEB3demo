import { test, expect, request } from '@playwright/test';
import { ethers } from 'ethers';

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

