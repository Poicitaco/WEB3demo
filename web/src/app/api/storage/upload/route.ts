import { NextResponse } from 'next/server';
import { getSessionAddress } from '@/lib/auth';
import { putCiphertext } from '@/lib/storage';
import { verifyCsrf } from '@/lib/csrf';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const address = await getSessionAddress();
  if (!address) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await verifyCsrf(req))) return NextResponse.json({ error: 'CSRF' }, { status: 403 });

  const form = await req.formData();
  const file = form.get('file');
  const name = form.get('name');
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: 'Missing file' }, { status: 400 });
  }
  // Basic validations: type and size (20MB limit for demo)
  const maxBytes = 20 * 1024 * 1024;
  const size = (file as Blob).size ?? 0;
  const type = (file as Blob).type ?? 'application/octet-stream';
  if (size <= 0) return NextResponse.json({ error: 'Empty file' }, { status: 400 });
  if (size > maxBytes) return NextResponse.json({ error: 'File too large', maxBytes }, { status: 413 });
  if (type && type !== 'application/octet-stream') {
    return NextResponse.json({ error: 'Unsupported media type' }, { status: 415 });
  }
  const { cid } = await putCiphertext(file, typeof name === 'string' ? name : undefined);
  return NextResponse.json({ cid });
}
