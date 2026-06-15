"use client";

import { useMemo, useState } from 'react';
import DurationPicker from '@/components/DurationPicker';
import FileSelectCombobox from '@/components/FileSelectCombobox';
import { useToast } from '@/components/Toast';

export default function TokenIssuer() {
  const toast = useToast();
  const [selected, setSelected] = useState('');
  const [ttl, setTtl] = useState(1440);
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
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf': csrf },
        body: JSON.stringify({ fileId: selected, ttlMinutes: ttl, issuedTo: issuedTo || null }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Không thể tạo liên kết');
      setToken(data.token as string);
      toast.success('Đã tạo liên kết chia sẻ mới');
      window.dispatchEvent(new CustomEvent('tokens:changed'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  }

  async function copy(value: string, message: string) {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
    toast.success(message);
  }

  return (
    <section className="glass allow-overflow p-4 space-y-4">
      <div className="form-section-heading">
        <div><strong>Tạo liên kết chia sẻ</strong><span>Cấp quyền mở tệp trong một khoảng thời gian cụ thể.</span></div>
      </div>
      <div className="token-issuer-grid">
        <FileSelectCombobox value={selected} onChange={setSelected} autoSelectFirst />
        <DurationPicker value={ttl} onChange={setTtl} />
        <div>
          <label className="label">Giới hạn cho một địa chỉ ví</label>
          <input className={`input ${isEth ? '' : 'border-red-500'}`} placeholder="Địa chỉ 0x, không bắt buộc" value={issuedTo} onChange={(event) => setIssuedTo(event.target.value)} />
          {!isEth && <div className="field-error">Địa chỉ Ethereum không hợp lệ</div>}
        </div>
      </div>
      <div className="token-issuer-actions">
        <button className="btn-primary" disabled={disabled} onClick={issue}>Tạo liên kết</button>
        {token && (
          <div className="issued-token">
            <code>{token}</code>
            <button className="btn-secondary text-xs" onClick={() => copy(token, 'Đã sao chép mã truy cập')}>Sao chép mã</button>
            <button className="btn-secondary text-xs" onClick={() => copy(`${location.origin}/download?token=${encodeURIComponent(token)}`, 'Đã sao chép liên kết')}>Sao chép liên kết</button>
            {copied && <span>Đã sao chép</span>}
          </div>
        )}
      </div>
    </section>
  );
}
