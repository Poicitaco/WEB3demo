"use client";

import { useEffect, useState } from 'react';

type TokenRow = {
  token: string; file_id: string; revoked: number; expires_at: string | null; created_at: string;
  title: string | null; name: string | null; size_bytes: number | null;
};

export default function TokenManager() {
  const [rows, setRows] = useState<TokenRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ensureCsrf() {
    try { const r = await fetch('/api/csrf'); await r.json(); } catch {}
    const m = document.cookie.match(/(?:^|; )csrf=([^;]+)/);
    return m ? decodeURIComponent(m[1]) : '';
  }

  async function load() {
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/tokens/list');
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to load');
      setRows(data.tokens as TokenRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);
  useEffect(() => {
    const onChanged = () => load();
    window.addEventListener('tokens:changed', onChanged as EventListener);
    return () => window.removeEventListener('tokens:changed', onChanged as EventListener);
  }, []);

  async function revoke(token: string) {
    const csrf = await ensureCsrf();
    const res = await fetch('/api/tokens/revoke', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-csrf': csrf }, body: JSON.stringify({ token })
    });
    if (res.ok) load();
  }

  if (loading && rows.length === 0) return <div className="glass p-4 text-sm">Loading tokens…</div>;
  if (error) return <div className="glass p-4 text-sm text-red-400">{error}</div>;

  return (
    <div className="glass p-4 overflow-x-auto">
      <div className="text-sm font-semibold mb-2">Share Tokens</div>
      {rows.length === 0 ? (
        <div className="text-sm muted">No tokens found.</div>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-left muted">
            <tr>
              <th className="py-2 pr-3">Token</th>
              <th className="py-2 pr-3">File</th>
              <th className="py-2 pr-3">Status</th>
              <th className="py-2 pr-3">Expires</th>
              <th className="py-2 pr-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.token} className="border-t border-[rgba(255,255,255,0.08)]">
                <td className="py-2 pr-3 font-mono text-xs">{r.token.slice(0, 8)}…</td>
                <td className="py-2 pr-3">{r.title || r.name || 'file'}</td>
                <td className="py-2 pr-3">{r.revoked ? 'Revoked' : 'Active'}</td>
                <td className="py-2 pr-3">{r.expires_at ? new Date(r.expires_at).toLocaleString() : '—'}</td>
                <td className="py-2 pr-3">
                  <button className="btn-secondary text-xs" disabled={!!r.revoked} onClick={() => revoke(r.token)}>Revoke</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
