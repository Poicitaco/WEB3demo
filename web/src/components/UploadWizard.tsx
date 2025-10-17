"use client";

import { useCallback, useMemo, useRef, useState } from 'react';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/contexts/AuthContext';

function bufToBase64(buf: ArrayBuffer) {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

type Step = 1 | 2 | 3;

function strengthLabel(pw: string) {
  const len = pw.length;
  const hasLower = /[a-z]/.test(pw);
  const hasUpper = /[A-Z]/.test(pw);
  const hasNum = /\d/.test(pw);
  const hasSym = /[^\w]/.test(pw);
  let score = 0;
  if (len >= 8) score++;
  if (len >= 12) score++;
  if (hasLower && hasUpper) score++;
  if (hasNum) score++;
  if (hasSym) score++;
  if (!pw) return { label: 'Optional', className: 'muted' } as const;
  if (score >= 4) return { label: 'Strong', className: 'text-cyan-300' } as const;
  if (score >= 2) return { label: 'Medium', className: 'text-yellow-300' } as const;
  return { label: 'Weak', className: 'text-red-400' } as const;
}

const allowDemoRaw = process.env.NEXT_PUBLIC_ALLOW_DEMO_RAW_KEYS === 'true';

export default function UploadWizard() {
  const { address } = useAuth();
  const toast = useToast();
  const [step, setStep] = useState<Step>(1);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState('');
  const [token, setToken] = useState('');
  const [cid, setCid] = useState('');
  const [description, setDescription] = useState('');
  const [ttl, setTtl] = useState<number>(1440);
  const [passphrase, setPassphrase] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) setFile(f);
    setDragActive(false);
  }, []);

  const onBrowse = () => inputRef.current?.click();

  const disabled = useMemo(() => {
    const titleOk = title.trim().length > 0;
    const passOk = allowDemoRaw ? true : passphrase.trim().length > 0;
    const connected = Boolean(address);
    return !file || !titleOk || !passOk || !connected;
  }, [file, title, passphrase, address]);

  const onSubmit = async () => {
    if (!file) return;
    if (!allowDemoRaw && !passphrase.trim()) {
      setStatus('Passphrase is required to wrap the key.');
      return;
    }
    setStatus('Encrypting…');
    setToken('');
    setCid('');
    try {
      setStep(2);
      const plain = await file.arrayBuffer();
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
      const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain);
      const rawKey = await crypto.subtle.exportKey('raw', key);

      setStatus('Uploading…');
      const blob = new Blob([ciphertext], { type: 'application/octet-stream' });
      const form = new FormData();
      form.append('file', blob, 'ciphertext.bin');
      form.append('name', file.name);
      // Ensure CSRF cookie and header
      const csrfRes = await fetch('/api/csrf');
      const { csrf } = await csrfRes.json().catch(() => ({ csrf: '' }));
      const up = await fetch('/api/storage/upload', { method: 'POST', body: form, headers: { 'x-csrf': csrf } });
      if (up.status === 401) throw new Error('Please connect your wallet before uploading.');
      if (!up.ok) throw new Error(await up.text().catch(() => 'Upload failed'));
      const { cid } = (await up.json()) as { cid: string };
      setCid(cid);

      setStatus('Saving metadata…');
      let payload: Record<string, unknown> = {
        title: title || file.name,
        description,
        cid,
        fileName: file.name,
        mime: file.type || 'application/octet-stream',
        sizeBytes: file.size,
        iv: bufToBase64(iv.buffer),
        ttlMinutes: ttl,
      };
      if (passphrase.trim()) {
        const enc = new TextEncoder();
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const baseKey = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
        const wrapKey = await crypto.subtle.deriveKey(
          { name: 'PBKDF2', salt, iterations: 200000, hash: 'SHA-256' },
          baseKey,
          { name: 'AES-GCM', length: 256 },
          true,
          ['encrypt', 'decrypt']
        );
        const ivWrap = crypto.getRandomValues(new Uint8Array(12));
        const wrapped = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: ivWrap }, wrapKey, rawKey);
        payload = {
          ...payload,
          salt: bufToBase64(salt.buffer),
          ivWrap: bufToBase64(ivWrap.buffer),
          wrappedKey: bufToBase64(wrapped),
        };
      } else if (allowDemoRaw) {
        payload = { ...payload, rawKeyBase64: bufToBase64(rawKey) };
      }
      const res = await fetch('/api/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf': csrf },
        body: JSON.stringify(payload),
      });
      if (res.status === 401) throw new Error('Please connect your wallet to save file metadata.');
      if (!res.ok) throw new Error(await res.text().catch(() => 'Save metadata failed'));
      const data = (await res.json()) as { token: string };
      setToken(data.token);
      setStatus('Done');
      toast.success('Upload complete');
      setStep(3);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setStatus('Error: ' + msg);
      toast.error(msg);
      setStep(1);
    }
  };

  return (
    <div className="glass p-5 sm:p-6" aria-live="polite">
      {/* Step tabs */}
      <div className="mb-6">
        <div className="grid grid-cols-3 gap-3 text-xs font-medium">
          {[{ n: 1, t: 'Basic Info' }, { n: 2, t: 'Encrypt & Upload' }, { n: 3, t: 'Share' }].map((s) => (
            <div
              key={s.n}
              className={`h-1.5 rounded-full ${step >= (s.n as Step) ? 'bg-gradient-to-r from-[var(--accent-1)] to-[var(--accent-3)]' : 'bg-[rgba(255,255,255,0.08)]'}`}
              title={s.t}
            />
          ))}
        </div>
        <div className="mt-2 grid grid-cols-3 text-[11px] muted">
          <div>Basic Info</div>
          <div className="text-center">Encrypt & Upload</div>
          <div className="text-right">Share</div>
        </div>
      </div>

      {/* Two column layout */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* Dropzone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={onDrop}
          className={`relative rounded-xl transition-colors p-6 flex flex-col items-center justify-center min-h-[260px] text-center border ${dragActive ? 'border-[var(--accent-3)]' : 'border-[rgba(255,255,255,0.18)] border-dashed hover:border-[rgba(255,255,255,0.35)]'}`}
        >
          <input ref={inputRef} type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          <div className="text-sm mb-3">Drop file here</div>
          <div className="text-xs muted mb-4">or</div>
          <button type="button" className="btn-secondary" onClick={onBrowse}>
            Browse
          </button>
          <div className="text-[11px] muted mt-4">Max ~20MB for demo</div>
          {file && (
            <div className="mt-4 text-xs">
              <div className="font-mono">{file.name}</div>
              <div className="muted">{(file.size / 1024 / 1024).toFixed(2)} MB</div>
            </div>
          )}
        </div>

        {/* Right form */}
        <div className="space-y-4">
          <div>
            <div className="text-sm font-semibold">Basic Info</div>
            <div className="mt-2 text-xs muted">Give your upload a name and then encrypt.</div>
          </div>

          <label className="label">Title</label>
          <input
            placeholder="My encrypted document"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="input"
          />

          <label className="label">Description</label>
          <textarea
            placeholder="Optional notes about this file"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="textarea"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Token TTL (minutes)</label>
              <div className="flex items-center gap-3">
                <input type="range" min={10} max={4320} step={10} value={ttl} onChange={(e) => setTtl(parseInt(e.target.value || '0', 10))} className="w-full" />
                <span className="badge">{ttl}</span>
              </div>
              <div className="text-[11px] muted mt-1">10 min – 3 days</div>
            </div>
            <div>
              <label className="label">Passphrase (wrap key)</label>
              <input type="password" placeholder="Optional — increases security" value={passphrase} onChange={(e) => setPassphrase(e.target.value)} className="input" />
              <div className="text-[11px] muted mt-1 flex items-center gap-2">
                <span>Wraps AES key with PBKDF2 (200k) + AES-GCM.</span>
                <span className={`badge ${strengthLabel(passphrase).className}`}>{strengthLabel(passphrase).label}</span>
              </div>
              {!allowDemoRaw && <div className="text-[11px] text-yellow-300 mt-1">Passphrase is required.</div>}
            </div>
          </div>

          <div className="pt-2">
            <button className="btn-primary" disabled={disabled} onClick={onSubmit}>
              {step === 2 ? 'Working…' : 'Encrypt & Upload'}
            </button>
            {!address && <span className="text-[11px] text-yellow-300 ml-3">Connect wallet to save</span>}
          </div>

          {status && <div className="text-xs muted">{status}</div>}

          {token && (
            <div className="text-sm">
              <div className="muted text-xs mb-1">Share token</div>
              <div className="glass p-3 rounded-md flex items-center justify-between gap-3">
                <code className="text-xs break-all">{token}</code>
                <button
                  className="btn-secondary text-xs"
                  onClick={async () => {
                    await navigator.clipboard.writeText(token);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1200);
                  }}
                >
                  Copy
                </button>
              </div>
              <div className="muted text-[11px] mt-1">Use it at Download to decrypt. CID: {cid.slice(0, 12)}...</div>
              <div className="mt-3 flex gap-2">
                <a className="btn-primary text-xs" href={`/download?token=${encodeURIComponent(token)}`}>
                  Open download
                </a>
                <button
                  className="btn-secondary text-xs"
                  onClick={async () => {
                    await navigator.clipboard.writeText(`${location.origin}/download?token=${encodeURIComponent(token)}`);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1200);
                  }}
                >
                  Copy link
                </button>
              </div>
              {copied && <div className="text-[11px] text-cyan-300 mt-1">Copied to clipboard</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
