import { getDb } from '@/lib/db';
import { cookies } from 'next/headers';
import { verifySession } from '@/lib/jwt';
import PageIntro from '@/components/PageIntro';
import DocumentInbox, { type InboxDocument } from '@/components/DocumentInbox';
import DashboardOverview, { type ActivityEvent } from '@/components/DashboardOverview';
import DashboardTools from '@/components/DashboardTools';

export default async function DashboardPage() {
  const c = await cookies();
  const token = c.get('session')?.value ?? '';
  let address: string | null = null;
  if (token) {
    try { address = (await verifySession(token)).address; } catch { address = null; }
  }
  if (!address) {
    return (
    <div className="page-shell">
      <PageIntro kicker="Không gian của bạn" title="Mọi tài liệu và quyền truy cập, ở một nơi." copy="Kết nối ví để xem tài liệu đã gửi, thành viên nhóm và những liên kết vẫn còn hiệu lực." />
      <p className="text-sm muted">Kết nối ví để mở không gian của bạn.</p>
    </div>
  );
  }
  const db = getDb();
  type SentRow = {
    id: string; title: string | null; name: string | null; size_bytes: number | null; created_at: string;
    vault_name: string | null; version_number: number;
  };
  const sentRows = db.prepare(
    `SELECT f.id, f.title, f.name, f.size_bytes, f.created_at, f.version_number, v.name AS vault_name
     FROM files f
     LEFT JOIN vaults v ON v.id = f.vault_id
     WHERE f.owner_address = ? AND f.destroyed_at IS NULL
     ORDER BY f.created_at DESC LIMIT 200`
  ).all(address) as SentRow[];
  type ReceivedRow = SentRow & { token: string };
  const receivedRows = db.prepare(
    `SELECT f.id, f.title, f.name, f.size_bytes, t.created_at, f.version_number, v.name AS vault_name, t.token
     FROM tokens t
     JOIN files f ON f.id = t.file_id
     LEFT JOIN vaults v ON v.id = f.vault_id
     WHERE t.issued_to_address = ? AND t.revoked = 0 AND f.destroyed_at IS NULL
       AND (t.expires_at IS NULL OR datetime(t.expires_at) > datetime('now'))
     ORDER BY t.created_at DESC LIMIT 200`
  ).all(address.toLowerCase()) as ReceivedRow[];
  type WaitingRow = SentRow & { approval_count: number; threshold: number };
  const waitingRows = db.prepare(
    `SELECT r.id, f.title, f.name, f.size_bytes, r.created_at, f.version_number, v.name AS vault_name,
            (SELECT COUNT(*) FROM approval_contributions c WHERE c.request_id = r.id) AS approval_count,
            r.threshold
     FROM approval_requests r
     JOIN files f ON f.id = r.file_id
     JOIN vaults v ON v.id = f.vault_id
     JOIN threshold_file_shares s ON s.file_id = r.file_id AND s.member_address = ?
     WHERE r.status = 'pending' AND f.destroyed_at IS NULL
       AND datetime(r.expires_at) > datetime('now')
       AND NOT EXISTS (
         SELECT 1 FROM approval_contributions c WHERE c.request_id = r.id AND c.approver_address = ?
       )
     ORDER BY r.created_at DESC LIMIT 200`
  ).all(address.toLowerCase(), address.toLowerCase()) as WaitingRow[];
  const sent: InboxDocument[] = sentRows.map((row) => ({
    id: row.id, title: row.title, name: row.name, sizeBytes: row.size_bytes, createdAt: row.created_at,
    context: row.vault_name || 'Tài liệu cá nhân', version: row.version_number,
  }));
  const received: InboxDocument[] = receivedRows.map((row) => ({
    id: row.id, title: row.title, name: row.name, sizeBytes: row.size_bytes, createdAt: row.created_at,
    context: row.vault_name || 'Được gửi trực tiếp', version: row.version_number, token: row.token,
  }));
  const waiting: InboxDocument[] = waitingRows.map((row) => ({
    id: row.id, title: row.title, name: row.name, sizeBytes: row.size_bytes, createdAt: row.created_at,
    context: row.vault_name, progress: `${row.approval_count}/${row.threshold} người đã đồng ý`,
  }));
  const activeLinks = (db.prepare(
    `SELECT COUNT(*) AS count
     FROM tokens t JOIN files f ON f.id = t.file_id
     WHERE f.owner_address = ? AND t.revoked = 0 AND f.destroyed_at IS NULL
       AND (t.expires_at IS NULL OR datetime(t.expires_at) > datetime('now'))`
  ).get(address) as { count: number }).count;
  const workspaces = (db.prepare(
    'SELECT COUNT(*) AS count FROM vault_members WHERE address = ?'
  ).get(address.toLowerCase()) as { count: number }).count;
  const auditRows = db.prepare(
    `SELECT id, action, outcome, resource_id, created_at
     FROM audit_events
     WHERE actor_address = ?
     ORDER BY created_at DESC LIMIT 8`
  ).all(address.toLowerCase()) as Array<{
    id: string; action: string; outcome: string; resource_id: string | null; created_at: string;
  }>;
  const events: ActivityEvent[] = auditRows.map((row) => ({
    id: row.id, action: row.action, outcome: row.outcome, resourceId: row.resource_id, createdAt: row.created_at,
  }));
  return (
    <div className="page-shell space-y-4">
      <PageIntro kicker="Không gian của bạn" title="Mọi tài liệu và quyền truy cập, ở một nơi." copy="Xem tài liệu đã gửi, quản lý nhóm, thu hồi liên kết và kiểm tra những yêu cầu đang chờ." />
      <DashboardOverview
        stats={{ sent: sent.length, received: received.length, waiting: waiting.length, activeLinks, workspaces }}
        events={events}
      />
      <DocumentInbox sent={sent} received={received} waiting={waiting} />
      <DashboardTools />
    </div>
  );
}
