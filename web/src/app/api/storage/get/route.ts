import { NextResponse } from 'next/server';
import { getCiphertext } from '@/lib/storage';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const cid = searchParams.get('cid');
  if (!cid) return NextResponse.json({ error: 'Missing cid' }, { status: 400 });
  return getCiphertext(cid);
}
