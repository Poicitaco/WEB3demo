import { NextResponse } from 'next/server';
import { clearNonceCookie, setSessionCookie, getNonceCookie } from '@/lib/auth';
import { signSession } from '@/lib/jwt';
import { ethers } from 'ethers';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { address, signature } = body as { address?: string; signature?: string };
  if (!address || !signature) return NextResponse.json({ error: 'Missing params' }, { status: 400 });

  const nonce = await getNonceCookie();
  if (!nonce) return NextResponse.json({ error: 'Missing nonce' }, { status: 400 });

  const message = `Sign this nonce to login: ${nonce}`;

  let recovered: string;
  try {
    recovered = ethers.verifyMessage(message, signature);
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  if (recovered.toLowerCase() !== address.toLowerCase()) {
    return NextResponse.json({ error: 'Address mismatch' }, { status: 401 });
  }

  await clearNonceCookie();
  const token = await signSession(address);
  await setSessionCookie(token);
  return NextResponse.json({ ok: true, address });
}
