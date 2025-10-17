"use client";

import { useMemo, useState } from 'react';
import { useToast } from '@/components/Toast';
import FileSelectCombobox from '@/components/FileSelectCombobox';

export default function TokenIssuer() {
  const toast = useToast();
  const [selected, setSelected] = useState<string>('');
  const [ttl, setTtl] = useState<number>(1440);
  const [issuedTo, setIssuedTo] = useState('');
  const [token, setToken] = useState('');
  const [copied, setCopied] = useState(false);
  const isEth = useMemo(() => issuedTo.trim() === '' || /^0x[a-fA-F0-9]{40}$/.test(issuedTo.trim()), [issuedTo]);
  const disabled = useMemo(() => !selected || ttl < 10 || ttl > 4320 || !isEth, [selected, ttl, isEth]);

  async function issue() {
    setToken('');
    try {
      const csrfRes = await fetch('/api/csrf');
      const { csrf } = await csrfRes.json().catch(() => ({ csrf: '' }));
      const res = await fetch('/api/tokens/issue', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-csrf': csrf },
        body: JSON.stringify({ fileId: selected, ttlMinutes: ttl, issuedTo: issuedTo || null })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Issue failed');
      setToken(data.token as string);
      toast.success('New token issued');
      window.dispatchEvent(new CustomEvent('tokens:changed'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="glass p-4 space-y-4">
      <div className="text-sm font-semibold">Tạo Mã Chia Sẻ</div>
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-end">
        <FileSelectCombobox value={selected} onChange={setSelected} className="lg:col-span-2" autoSelectFirst />
        <div>
          <label className="label">TTL (phút)</label>
          <div className="flex items-center gap-3">
            <input className="w-full" type="range" min={10} max={4320} step={10} value={ttl} onChange={(e) => setTtl(parseInt(e.target.value || '0', 10))} />
            <input className="input w-24" aria-label="TTL" type="number" min={10} max={4320} step={10} value={ttl} onChange={(e) => setTtl(parseInt(e.target.value || '0', 10))} />
          </div>
          <div className="text-[11px] muted mt-1">10 phút – 3 ngày</div>
        </div>
        <div>
          <label className="label">Cấp cho (địa chỉ)</label>
          <input
            className={`input ${isEth ? '' : 'border-red-500'}`}
            placeholder="Optional 0x…"
            value={issuedTo}
            onChange={(e) => setIssuedTo(e.target.value)}
          />
          {!isEth && <div className="text-[11px] text-red-400 mt-1">Địa chỉ Ethereum không hợp lệ</div>}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn-primary" disabled={disabled} onClick={issue}>Tạo Token</button>
        {token && (
          <div className="flex items-center gap-2">
            <code className="text-xs break-all">{token}</code>
            <button
              className="btn-secondary text-xs"
              onClick={async () => {
                await navigator.clipboard.writeText(token);
                setCopied(true);
                setTimeout(() => setCopied(false), 1200);
                toast.success('Đã sao chép token');
              }}
            >Sao chép</button>
            <button
              className="btn-secondary text-xs"
              onClick={async () => {
                const url = `${location.origin}/download?token=${encodeURIComponent(token)}`;
                await navigator.clipboard.writeText(url);
                setCopied(true);
                setTimeout(() => setCopied(false), 1200);
                toast.success('Đã sao chép liên kết');
              }}
            >Sao chép link</button>
            {copied && <span className="text-[11px] text-cyan-300">Copied</span>}
          </div>
        )}
      </div>
    </div>
  );
}
