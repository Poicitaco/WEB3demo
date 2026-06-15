"use client";

import { useEffect, useState } from 'react';
import { useToast } from '@/components/Toast';
import { formatDateTimeUtc } from '@/lib/dateFormat';

type TokenRow = {
  token: string;
  file_id: string;
  issued_to_address: string | null;
  revoked: number;
  expires_at: string | null;
  created_at: string;
  title: string | null;
  name: string | null;
  size_bytes: number | null;
  max_downloads: number | null;
  download_count: number;
  destroyed_at: string | null;
};

export default function TokenManager() {
  const toast = useToast();
  const [rows, setRows] = useState<TokenRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState<number | null>(null);

  async function ensureCsrf() {
    try {
      const response = await fetch('/api/csrf');
      const data = await response.json();
      return data.csrf || '';
    } catch {
      return '';
    }
  }

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/tokens/list');
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Không thể tải liên kết');
      setRows(data.tokens as TokenRow[]);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);
  useEffect(() => {
    setNow(Date.now());
    const interval = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(interval);
  }, []);
  useEffect(() => {
    const onChanged = () => load();
    window.addEventListener('tokens:changed', onChanged);
    return () => window.removeEventListener('tokens:changed', onChanged);
  }, []);

  async function revoke(token: string) {
    const csrf = await ensureCsrf();
    const res = await fetch('/api/tokens/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-csrf': csrf },
      body: JSON.stringify({ token }),
    });
    if (!res.ok) {
      toast.error('Không thể thu hồi liên kết');
      return;
    }
    toast.success('Đã thu hồi. Liên kết cũ không thể sử dụng lại.');
    load();
  }

  async function reissue(row: TokenRow) {
    const csrf = await ensureCsrf();
    const res = await fetch('/api/tokens/issue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-csrf': csrf },
      body: JSON.stringify({ fileId: row.file_id, ttlMinutes: 1440, issuedTo: row.issued_to_address }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error || 'Không thể cấp liên kết mới');
      return;
    }
    const link = `${location.origin}/download?token=${encodeURIComponent(data.token)}`;
    try {
      await navigator.clipboard.writeText(link);
      toast.success('Đã cấp và sao chép liên kết mới. Liên kết cũ vẫn bị thu hồi.');
    } catch {
      toast.success(`Đã cấp liên kết mới: ${link}`);
    }
    load();
  }

  if (loading && rows.length === 0) return <div className="glass p-4 text-sm">Đang tải liên kết...</div>;
  if (error) return <div className="glass p-4 text-sm text-red-400">{error}</div>;

  return (
    <section className="glass p-4">
      <div className="form-section-heading">
        <div><strong>Liên kết đã cấp</strong><span>Thu hồi vĩnh viễn hoặc cấp một liên kết mới cho cùng tệp.</span></div>
      </div>
      {rows.length === 0 ? <div className="empty-state-compact">Chưa có liên kết chia sẻ.</div> : (
        <div className="table-scroll">
          <table className="w-full text-sm">
            <thead><tr><th>Tệp</th><th>Trạng thái</th><th>Người nhận</th><th>Lượt tải</th><th>Hết hạn</th><th>Thao tác</th></tr></thead>
            <tbody>
              {rows.map((row) => {
                const expired = Boolean(now && row.expires_at && new Date(row.expires_at).getTime() < now);
                const inactive = Boolean(row.destroyed_at || row.revoked || expired);
                return (
                  <tr key={row.token}>
                    <td><strong>{row.title || row.name || 'Tệp'}</strong><small className="table-subtext">{row.token.slice(0, 8)}...</small></td>
                    <td><span className={`status-pill ${inactive ? 'inactive' : 'active'}`}>{row.destroyed_at ? 'Đã huỷ' : row.revoked ? 'Đã thu hồi' : expired ? 'Đã hết hạn' : 'Đang hoạt động'}</span></td>
                    <td className="font-mono text-xs">{row.issued_to_address ? `${row.issued_to_address.slice(0, 6)}...${row.issued_to_address.slice(-4)}` : 'Bất kỳ ai có liên kết'}</td>
                    <td>{row.max_downloads == null ? 'Không giới hạn' : `${Math.max(0, row.max_downloads - row.download_count)} / ${row.max_downloads}`}</td>
                    <td>{row.expires_at ? formatDateTimeUtc(row.expires_at) : '-'}</td>
                    <td>{row.destroyed_at
                      ? <span className="table-subtext">Không thể cấp lại</span>
                      : inactive
                        ? <button className="btn-secondary text-xs" onClick={() => reissue(row)}>Cấp liên kết mới</button>
                        : <button className="btn-secondary text-xs" onClick={() => revoke(row.token)}>Thu hồi</button>
                    }</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
