import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { setNonceCookie } from '@/lib/auth';

export const runtime = 'nodejs';

export async function POST() {
  const nonce = randomUUID();
  await setNonceCookie(nonce);
  return NextResponse.json({ nonce, message: `Sign this nonce to login: ${nonce}` });
}
