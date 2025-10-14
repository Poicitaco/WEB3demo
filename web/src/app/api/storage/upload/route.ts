import { NextResponse } from 'next/server';
import { getSessionAddress } from '@/lib/auth';
import { putCiphertext } from '@/lib/storage';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const address = await getSessionAddress();
  if (!address) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const form = await req.formData();
  const file = form.get('file');
  const name = form.get('name');
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: 'Missing file' }, { status: 400 });
  }
  const { cid } = await putCiphertext(file, typeof name === 'string' ? name : undefined);
  return NextResponse.json({ cid });
}
