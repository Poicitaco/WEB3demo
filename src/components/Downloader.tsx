"use client";

import { useEffect, useMemo, useState } from 'react';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/contexts/AuthContext';
import { getLocalEncryptionIdentity } from '@/lib/clientEncryptionIdentity';
import { unwrapFileKeyFromRecipientEnvelope } from '@/lib/clientRecipientEnvelope';
import type { RecipientKeyEnvelope } from '@/lib/recipientEnvelope';

function base64ToArrayBuffer(b64: string) {
  const bin = atob(b64);
  const len = bin.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

function formatBytes(n: number) {
  if (!Number.isFinite(n)) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let x = n;
  while (x >= 1024 && i < units.length - 1) {
    x /= 1024;
    i++;
  }
  return `${x.toFixed(1)} ${units[i]}`;
}

type Meta = {
  ok: boolean;
  cid: string;
  name?: string;
  mime?: string;
  sizeBytes?: number;
  iv: string;
  rawKeyBase64?: string;
  salt?: string;
  ivWrap?: string;
  wrappedKey?: string;
  recipientAddress?: string;
  recipientEnvelope?: RecipientKeyEnvelope;
  thresholdProtected?: boolean;
};

export default function Downloader() {
  const { address } = useAuth();
  const toast = useToast();
  const [token, setToken] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [meta, setMeta] = useState<Meta | null>(null);
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const needsPass = useMemo(
    () => Boolean(meta && !meta.rawKeyBase64 && !meta.recipientEnvelope && !meta.thresholdProtected),
    [meta]
  );

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const t = sp.get('token');
    if (t) setToken(t);
  }, []);

  async function validate() {
    setStatus('Validating token…');
    setMeta(null);
    setProgress(0);
    const res = await fetch('/api/tokens/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    const m = (await res.json()) as Meta & { error?: string };
    if (!m.ok) throw new Error(m.error || 'Invalid token');
    setMeta(m);
    setStatus('Ready');
    toast.success('Token validated');
  }

  async function downloadAndDecrypt() {
    if (!meta) return;
    if (meta.thresholdProtected) {
      toast.error('This file requires vault approvals. Use the dashboard approval workflow.');
      return;
    }
    setDownloading(true);
    setStatus('Fetching ciphertext…');
    setProgress(0);
    try {
      const url = `/api/storage/get?cid=${encodeURIComponent(meta.cid)}`;
      const res = await fetch(url);
      if (!res.ok || !res.body) throw new Error('Fetch failed');
      const total = Number(res.headers.get('content-length') || 0);
      const reader = res.body.getReader();
      const chunks: Uint8Array[] = [];
      let received = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          received += value.length;
          if (total) setProgress(Math.round((received / total) * 100));
        }
      }
      const cipherBuf = new Uint8Array(received);
      let offset = 0;
      for (const c of chunks) {
        cipherBuf.set(c, offset);
        offset += c.length;
      }

      setStatus('Decrypting…');
      const webCrypto = globalThis.crypto;
      if (!webCrypto || !webCrypto.subtle) throw new Error('Web Crypto API not available');
      let raw: ArrayBuffer;
      if (meta.recipientEnvelope) {
        if (!address) throw new Error('Connect the recipient wallet to decrypt this file');
        const identity = await getLocalEncryptionIdentity(address);
        if (!identity) throw new Error('This device does not have the recipient private key');
        raw = await unwrapFileKeyFromRecipientEnvelope(meta.recipientEnvelope, identity.privateKey);
      } else if (meta.rawKeyBase64) {
        raw = base64ToArrayBuffer(meta.rawKeyBase64);
      } else {
        if (!passphrase) throw new Error('Enter passphrase to decrypt key');
        const enc = new TextEncoder();
        const salt = new Uint8Array(base64ToArrayBuffer(meta.salt!));
        const ivWrap = new Uint8Array(base64ToArrayBuffer(meta.ivWrap!));
        const wrapped = base64ToArrayBuffer(meta.wrappedKey!);
        const baseKey = await webCrypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
        const wrapKey = await webCrypto.subtle.deriveKey(
          { name: 'PBKDF2', salt, iterations: 200000, hash: 'SHA-256' },
          baseKey,
          { name: 'AES-GCM', length: 256 },
          false,
          ['decrypt']
        );
        raw = await webCrypto.subtle.decrypt({ name: 'AES-GCM', iv: ivWrap }, wrapKey, wrapped);
      }
      const key = await webCrypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['decrypt']);
      const iv = new Uint8Array(base64ToArrayBuffer(meta.iv));
      const plain = await webCrypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipherBuf.buffer);

      const blob = new Blob([plain], { type: meta.mime || 'application/octet-stream' });
      const urlObj = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = urlObj;
      a.download = meta.name || 'file';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(urlObj);
      setStatus('Downloaded');
      toast.success('Download complete');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const friendly = /OperationError/i.test(msg) ? 'Decryption failed. Check passphrase or token.' : msg;
      setStatus('Error: ' + friendly);
      toast.error(friendly);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="glass p-4 flex flex-col gap-3" aria-busy={downloading} aria-live="polite">
        <label className="label">Token</label>
        <input type="text" placeholder="Enter token" value={token} onChange={(e) => setToken(e.target.value)} className="input" />
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={validate} disabled={!token}>Validate</button>
          <button className="btn-primary" onClick={() => { if (!meta) validate().then(downloadAndDecrypt); else downloadAndDecrypt(); }} disabled={!token || downloading || Boolean(meta?.thresholdProtected)}>
            {downloading ? 'Working…' : 'Download & Decrypt'}
          </button>
        </div>
        {status && <div className="text-sm muted">{status}</div>}
        {downloading && (
          <div className="w-full h-2 rounded bg-[rgba(255,255,255,0.08)] overflow-hidden">
            <div className="h-full bg-gradient-to-r from-[var(--accent-1)] to-[var(--accent-3)] transition-all" style={{ width: `${progress}%` }} />
          </div>
        )}
      </div>

      {meta && (
        <div className="glass p-4">
          <div className="text-sm font-semibold mb-2">File details</div>
          <div className="text-xs grid grid-cols-2 gap-y-1">
            <div className="muted">Name</div><div>{meta.name || 'file'}</div>
            <div className="muted">Type</div><div>{meta.mime || 'application/octet-stream'}</div>
            <div className="muted">Size</div><div>{formatBytes(meta.sizeBytes || 0)}</div>
            <div className="muted">Protection</div>
            <div>{meta.thresholdProtected ? 'Threshold approval required' : meta.recipientEnvelope ? 'Recipient wallet E2EE' : needsPass ? 'Passphrase wrapped' : 'Raw key (demo)'}</div>
          </div>
          {needsPass && (
            <div className="mt-3">
              <label className="label">Passphrase</label>
              <input type="password" placeholder="Enter passphrase" value={passphrase} onChange={(e) => setPassphrase(e.target.value)} className="input" />
            </div>
          )}
          {meta.thresholdProtected && (
            <div className="mt-3 text-xs text-cyan-300">Open Dashboard and create a threshold approval request for this file.</div>
          )}
        </div>
      )}
    </div>
  );
}
