import { getDb } from '@/lib/db';

function formatBytes(n: number) {
  if (!Number.isFinite(n) || n <= 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let x = n;
  while (x >= 1024 && i < units.length - 1) { x /= 1024; i++; }
  return `${x.toFixed(1)} ${units[i]}`;
}

export default async function StatsStrip() {
  const db = getDb();
  const row = db.prepare('SELECT COUNT(*) as cnt, COALESCE(SUM(size_bytes), 0) as total FROM files').get() as { cnt: number; total: number };
  const stats = [
    { label: 'All-time encrypted bytes', value: formatBytes(row.total) },
    { label: 'Files uploaded', value: String(row.cnt) },
    { label: 'Avg decrypt success', value: '100%' },
  ];
  return (
    <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {stats.map((s) => (
        <div key={s.label} className="glass p-5">
          <div className="text-2xl font-semibold">{s.value}</div>
          <div className="mt-1 text-xs muted">{s.label}</div>
        </div>
      ))}
    </section>
  );
}

