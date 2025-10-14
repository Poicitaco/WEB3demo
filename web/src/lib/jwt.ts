import { SignJWT, jwtVerify } from 'jose';

const alg = 'HS256';

function getSecret() {
  const secret = process.env.JWT_SECRET || 'dev_change_me_secret';
  return new TextEncoder().encode(secret);
}

export async function signSession(address: string, ttlMinutes = 60 * 24) {
  const now = Math.floor(Date.now() / 1000);
  return await new SignJWT({ address })
    .setProtectedHeader({ alg })
    .setIssuedAt(now)
    .setExpirationTime(now + ttlMinutes * 60)
    .sign(getSecret());
}

export async function verifySession(token: string) {
  const { payload } = await jwtVerify(token, getSecret());
  if (typeof payload.address !== 'string') throw new Error('Invalid session payload');
  return payload as { address: string; iat: number; exp: number };
}
