import { getDb } from '@/lib/db';
import { cookies } from 'next/headers';
import { verifySession } from '@/lib/jwt';
import TokenManager from '@/components/TokenManager';
import TokenIssuer from '@/components/TokenIssuer';
import VaultManager from '@/components/VaultManager';

function formatBytes(n: number | null | undefined) {
  if (!n || n <= 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0; let x = n;
  while (x >= 1024 && i < units.length - 1) { x /= 1024; i++; }
  return `${x.toFixed(1)} ${units[i]}`;
}

export default async function DashboardPage() {
  const c = await cookies();
  const token = c.get('session')?.value ?? '';
  let address: string | null = null;
  if (token) {
    try { address = (await verifySession(token)).address; } catch { address = null; }
  }
  if (!address) {
    return (
    <div className="space-y-2">
      <h1 className="text-xl font-semibold">Dashboard</h1>
      <p className="text-sm muted">Connect your wallet to view your files.</p>
    </div>
  );
  }
  const db = getDb();
  type Row = {
    id: string; title: string | null; name: string | null; size_bytes: number | null; created_at: string;
    vault_name: string | null;
  };
  const rows = db.prepare(
    `SELECT DISTINCT f.id, f.title, f.name, f.size_bytes, f.created_at, v.name AS vault_name
     FROM files f
     LEFT JOIN vaults v ON v.id = f.vault_id
     LEFT JOIN vault_members m ON m.vault_id = f.vault_id AND m.address = ?
     WHERE (f.vault_id IS NULL AND f.owner_address = ?) OR m.address IS NOT NULL
     ORDER BY f.created_at DESC LIMIT 200`
  ).all(address.toLowerCase(), address) as Row[];
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Your Files</h1>
      {rows.length === 0 ? (
        <div className="glass p-4 text-sm">No files yet. Start by uploading.</div>
      ) : (
        <div className="glass p-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left muted">
              <tr>
                <th className="py-2 pr-3">Title</th>
                <th className="py-2 pr-3">Filename</th>
                <th className="py-2 pr-3">Size</th>
                <th className="py-2 pr-3">Vault</th>
                <th className="py-2 pr-3">Created</th>
                <th className="py-2 pr-3">ID</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-[rgba(255,255,255,0.08)]">
                  <td className="py-2 pr-3">{r.title || '—'}</td>
                  <td className="py-2 pr-3">{r.name || 'file'}</td>
                  <td className="py-2 pr-3">{formatBytes(r.size_bytes)}</td>
                  <td className="py-2 pr-3">{r.vault_name || 'Personal'}</td>
                  <td className="py-2 pr-3">{new Date(r.created_at).toLocaleString()}</td>
                  <td className="py-2 pr-3 font-mono text-xs">{r.id.slice(0, 8)}…</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <VaultManager />
      <TokenIssuer />
      <TokenManager />
    </div>
  );
}
