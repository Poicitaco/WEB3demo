import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Readable } from 'node:stream';
import { NextResponse } from 'next/server';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

type PutResult = { cid: string };

const provider = process.env.STORAGE_PROVIDER || 'local';
let r2Client: S3Client | null = null;

function storageDir() {
  const dir = path.join(process.cwd(), 'storage');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export async function putCiphertextLocal(file: Blob): Promise<PutResult> {
  const arrayBuffer = await file.arrayBuffer();
  const buf = Buffer.from(arrayBuffer);
  // Pseudo-CID: sha256 hex; for demo only
  const cid = crypto.createHash('sha256').update(buf).digest('hex');
  const outPath = path.join(storageDir(), cid);
  await fs.promises.writeFile(outPath, buf);
  // Optionally store original name metadata (skipped; kept in DB)
  return { cid };
}

export async function ciphertextExistsLocal(cid: string) {
  return fs.existsSync(path.join(storageDir(), cid));
}

function r2Config() {
  const accountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID;
  const bucket = process.env.CLOUDFLARE_R2_BUCKET;
  const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
  if (!accountId || !bucket || !accessKeyId || !secretAccessKey) {
    throw new Error('Cloudflare R2 storage is missing required environment variables');
  }
  return {
    bucket,
    keyPrefix: (process.env.CLOUDFLARE_R2_KEY_PREFIX || 'ciphertexts').replace(/^\/+|\/+$/g, ''),
    endpoint: process.env.CLOUDFLARE_R2_ENDPOINT || `https://${accountId}.r2.cloudflarestorage.com`,
    accessKeyId,
    secretAccessKey,
  };
}

function r2ObjectKey(cid: string) {
  const { keyPrefix } = r2Config();
  return keyPrefix ? `${keyPrefix}/${cid}` : cid;
}

function getR2Client() {
  if (r2Client) return r2Client;
  const { endpoint, accessKeyId, secretAccessKey } = r2Config();
  r2Client = new S3Client({
    region: 'auto',
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  });
  return r2Client;
}

export async function getCiphertextLocal(cid: string, deleteAfterRead = false) {
  const filePath = path.join(storageDir(), cid);
  if (!fs.existsSync(filePath)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const stream = fs.createReadStream(filePath);
  if (deleteAfterRead) {
    stream.once('close', () => {
      fs.promises.unlink(filePath).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== 'ENOENT') console.error('Failed to delete self-destructed ciphertext', error);
      });
    });
  }
  const webStream = Readable.toWeb(stream) as ReadableStream;
  const stat = fs.statSync(filePath);
  return new NextResponse(webStream, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Length': String(stat.size),
      'Cache-Control': 'private, no-store',
    },
  });
}

export async function putCiphertextR2(file: Blob): Promise<PutResult> {
  const buf = Buffer.from(await file.arrayBuffer());
  const cid = crypto.createHash('sha256').update(buf).digest('hex');
  const { bucket } = r2Config();
  await getR2Client().send(new PutObjectCommand({
    Bucket: bucket,
    Key: r2ObjectKey(cid),
    Body: buf,
    ContentType: 'application/octet-stream',
    CacheControl: 'private, no-store',
    Metadata: { cid },
  }));
  return { cid };
}

export async function ciphertextExistsR2(cid: string) {
  const { bucket } = r2Config();
  try {
    await getR2Client().send(new HeadObjectCommand({ Bucket: bucket, Key: r2ObjectKey(cid) }));
    return true;
  } catch (error) {
    const statusCode = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
    if (statusCode === 404) return false;
    throw error;
  }
}

export async function getCiphertextR2(cid: string, deleteAfterRead = false) {
  const { bucket } = r2Config();
  try {
    const result = await getR2Client().send(new GetObjectCommand({ Bucket: bucket, Key: r2ObjectKey(cid) }));
    const body = result.Body;
    if (!body) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    let responseBody: ReadableStream | ArrayBuffer;
    if (body instanceof Readable) {
      responseBody = Readable.toWeb(body) as ReadableStream;
    } else if ('transformToByteArray' in body && typeof body.transformToByteArray === 'function') {
      const bytes = await body.transformToByteArray();
      responseBody = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    } else {
      throw new Error('Unsupported R2 response body');
    }
    if (deleteAfterRead) {
      await getR2Client().send(new DeleteObjectCommand({ Bucket: bucket, Key: r2ObjectKey(cid) }));
    }
    return new NextResponse(responseBody, {
      headers: {
        'Content-Type': 'application/octet-stream',
        ...(result.ContentLength ? { 'Content-Length': String(result.ContentLength) } : {}),
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    const statusCode = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
    if (statusCode === 404) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    throw error;
  }
}

export async function putCiphertext(file: Blob): Promise<PutResult> {
  if (provider === 'local') return putCiphertextLocal(file);
  if (provider === 'r2') return putCiphertextR2(file);
  throw new Error('Unsupported STORAGE_PROVIDER');
}

export async function ciphertextExists(cid: string) {
  if (provider === 'local') return ciphertextExistsLocal(cid);
  if (provider === 'r2') return ciphertextExistsR2(cid);
  return false;
}

export async function getCiphertext(cid: string, deleteAfterRead = false) {
  if (provider === 'local') return getCiphertextLocal(cid, deleteAfterRead);
  if (provider === 'r2') return getCiphertextR2(cid, deleteAfterRead);
  throw new Error('Unsupported STORAGE_PROVIDER');
}
