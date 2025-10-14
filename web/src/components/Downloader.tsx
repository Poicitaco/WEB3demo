"use client";

import { useState } from 'react';

function base64ToArrayBuffer(b64: string) {
  const bin = atob(b64);
  const len = bin.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

export default function Downloader() {
  const [token, setToken] = useState('');
  const [status, setStatus] = useState('');

  const run = async () => {
    if (!token) return;
    setStatus('Validating token…');
    try {
      const res = await fetch('/api/tokens/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const meta = await res.json();
      if (!meta.ok) throw new Error(meta.error || 'Invalid token');

      setStatus('Fetching ciphertext…');
      const fileRes = await fetch(`/api/storage/get?cid=${encodeURIComponent(meta.cid)}`);
      if (!fileRes.ok) throw new Error('Fetch ciphertext failed');
      const cipherBuf = await fileRes.arrayBuffer();

      setStatus('Decrypting…');
      if (!meta.rawKeyBase64) throw new Error('Missing raw key (demo mode)');
      const raw = base64ToArrayBuffer(meta.rawKeyBase64);
      const key = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['decrypt']);
      const iv = new Uint8Array(base64ToArrayBuffer(meta.iv));
      const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipherBuf);

      const blob = new Blob([plain], { type: meta.mime || 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = meta.name || 'file';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setStatus('Downloaded');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setStatus('Error: ' + msg);
    }
  };

  return (
    <div className="border rounded p-4 flex flex-col gap-3">
      <input
        type="text"
        placeholder="Enter token"
        value={token}
        onChange={(e) => setToken(e.target.value)}
        className="text-sm px-2 py-1 border rounded w-full"
      />
      <button
        onClick={run}
        className="px-3 py-1.5 rounded bg-black text-white dark:bg-white dark:text-black text-sm disabled:opacity-50"
        disabled={!token}
      >
        Download & Decrypt
      </button>
      {status && <div className="text-sm">{status}</div>}
    </div>
  );
}
