import { cookies } from 'next/headers';
import { verifySession } from './jwt';

export async function setNonceCookie(nonce: string) {
  const c = await cookies();
  c.set('nonce', nonce, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 10 * 60,
  });
}

export async function getNonceCookie() {
  const c = await cookies();
  return c.get('nonce')?.value;
}

export async function clearNonceCookie() {
  const c = await cookies();
  c.set('nonce', '', { path: '/', maxAge: 0 });
}

export async function getSessionAddress() {
  const c = await cookies();
  const token = c.get('session')?.value;
  if (!token) return null;
  try {
    const payload = await verifySession(token);
    return payload.address as string;
  } catch {
    return null;
  }
}

export async function setSessionCookie(token: string) {
  const c = await cookies();
  c.set('session', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 24 * 60 * 60,
  });
}
