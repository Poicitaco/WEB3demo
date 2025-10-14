"use client";

import { useState } from 'react';

function bufToBase64(buf: ArrayBuffer) {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

export default function EncryptUploader() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string>('');
  const [token, setToken] = useState<string>('');

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFile(e.target.files?.[0] || null);
  };

  const run = async () => {
    if (!file) return;
    setStatus('Encrypting…');
    setToken('');
    try {
      const plain = await file.arrayBuffer();
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
        'encrypt',
        'decrypt',
      ]);
      const ciphertext = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        plain
      );
      const rawKey = await crypto.subtle.exportKey('raw', key);

      setStatus('Uploading ciphertext…');
      const blob = new Blob([ciphertext], { type: 'application/octet-stream' });
      const form = new FormData();
      form.append('file', blob, 'ciphertext.bin');
      form.append('name', file.name);
      const up = await fetch('/api/storage/upload', { method: 'POST', body: form });
      if (!up.ok) throw new Error('Upload failed');
      const { cid } = await up.json();

      setStatus('Saving metadata…');
      const res = await fetch('/api/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: file.name,
          cid,
          fileName: file.name,
          mime: file.type || 'application/octet-stream',
          sizeBytes: file.size,
          iv: bufToBase64(iv.buffer),
          rawKeyBase64: bufToBase64(rawKey),
        }),
      });
      if (!res.ok) throw new Error('Save metadata failed');
      const data = await res.json();
      setToken(data.token);
      setStatus('Done');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setStatus('Error: ' + msg);
    }
  };

  return (
    <div className="border rounded p-4 flex flex-col gap-3">
      <input type="file" onChange={onFileChange} className="text-sm" />
      <button
        className="px-3 py-1.5 rounded bg-black text-white dark:bg-white dark:text-black text-sm disabled:opacity-50"
        onClick={run}
        disabled={!file}
      >
        Encrypt & Upload
      </button>
      {status && <div className="text-sm">{status}</div>}
      {token && (
        <div className="text-sm break-all">
          Download token: <span className="font-mono">{token}</span>
        </div>
      )}
    </div>
  );
}
