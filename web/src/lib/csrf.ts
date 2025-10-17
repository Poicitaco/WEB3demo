import { cookies } from 'next/headers';
import { randomUUID } from 'node:crypto';

export async function issueCsrf() {
  const token = randomUUID();
  const c = await cookies();
  // Double-submit cookie pattern; not httpOnly so client can read if needed
  c.set('csrf', token, {
    httpOnly: false,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60, // 1h
  });
  return token;
}

export async function verifyCsrf(req: Request) {
  if ((process.env.REQUIRE_CSRF || '').toLowerCase() !== 'true') return true;
  const header = req.headers.get('x-csrf') || '';
  const c = await cookies();
  const cookie = c.get('csrf')?.value || '';
  return Boolean(header && cookie && header === cookie);
}

