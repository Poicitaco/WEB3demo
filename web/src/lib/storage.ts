import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Readable } from 'node:stream';
import { NextResponse } from 'next/server';

type PutResult = { cid: string };

const provider = process.env.STORAGE_PROVIDER || 'local';

function storageDir() {
  const dir = path.join(process.cwd(), 'storage');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export async function putCiphertextLocal(file: Blob, _name?: string): Promise<PutResult> {
  const arrayBuffer = await file.arrayBuffer();
  const buf = Buffer.from(arrayBuffer);
  // Pseudo-CID: sha256 hex; for demo only
  const cid = crypto.createHash('sha256').update(buf).digest('hex');
  const outPath = path.join(storageDir(), cid);
  await fs.promises.writeFile(outPath, buf);
  // Optionally store original name metadata (skipped; kept in DB)
  return { cid };
}

export async function getCiphertextLocal(cid: string) {
  const filePath = path.join(storageDir(), cid);
  if (!fs.existsSync(filePath)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const stream = fs.createReadStream(filePath);
  const webStream = Readable.toWeb(stream) as ReadableStream;
  return new NextResponse(webStream, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}

export async function putCiphertext(file: Blob, name?: string): Promise<PutResult> {
  if (provider === 'local') return putCiphertextLocal(file, name);
  // Future: implement w3up client upload here
  throw new Error('Unsupported STORAGE_PROVIDER');
}

export async function getCiphertext(cid: string) {
  if (provider === 'local') return getCiphertextLocal(cid);
  // Future: fetch from IPFS gateway
  throw new Error('Unsupported STORAGE_PROVIDER');
}
