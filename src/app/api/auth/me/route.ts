import { NextResponse } from 'next/server';
import { getSessionAddress } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET() {
  const address = await getSessionAddress();
  if (!address) return NextResponse.json({ ok: false });
  return NextResponse.json({ ok: true, address });
}

