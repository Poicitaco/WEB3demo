import { getDb } from '@/lib/db';
import { cookies } from 'next/headers';
import { verifySession } from '@/lib/jwt';
import TokenManager from '@/components/TokenManager';
import TokenIssuer from '@/components/TokenIssuer';

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
      <h1 className="text-xl font-semibold">Bảng điều khiển</h1>
      <p className="text-sm muted">Hãy kết nối ví để xem tệp của bạn.</p>
    </div>
  );
  }
  const db = getDb();
  type Row = { id: string; title: string | null; name: string | null; size_bytes: number | null; created_at: string };
  const rows = db.prepare("SELECT id, title, name, size_bytes, created_at FROM files WHERE owner_address = ? ORDER BY created_at DESC LIMIT 200").all(address) as Row[];
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Tệp của bạn</h1>
      {rows.length === 0 ? (
        <div className="glass p-4 text-sm">Chưa có tệp nào. Hãy tải lên để bắt đầu.</div>
      ) : (
        <div className="glass p-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left muted">
              <tr>
                <th className="py-2 pr-3">Tiêu đề</th>
                <th className="py-2 pr-3">Tên tệp</th>
                <th className="py-2 pr-3">Dung lượng</th>
                <th className="py-2 pr-3">Tạo lúc</th>
                <th className="py-2 pr-3">ID</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-[rgba(255,255,255,0.08)]">
                  <td className="py-2 pr-3">{r.title || '—'}</td>
                  <td className="py-2 pr-3">{r.name || 'file'}</td>
                  <td className="py-2 pr-3">{formatBytes(r.size_bytes)}</td>
                  <td className="py-2 pr-3">{new Date(r.created_at).toLocaleString()}</td>
                  <td className="py-2 pr-3 font-mono text-xs">{r.id.slice(0, 8)}…</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <TokenIssuer />
      <TokenManager />
    </div>
  );
}
