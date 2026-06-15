type OverviewStats = {
  sent: number;
  received: number;
  waiting: number;
  activeLinks: number;
  workspaces: number;
};

export type ActivityEvent = {
  id: string;
  action: string;
  createdAt: string;
  outcome: string;
  resourceId: string | null;
};

const actionLabels: Record<string, string> = {
  'auth.login': 'Đã đăng nhập vào không gian',
  'file.created': 'Đã gửi một tài liệu mới',
  'file.version_created': 'Đã tạo phiên bản tài liệu mới',
  'file.downloaded': 'Tài liệu đã được tải xuống',
  'file.viewed': 'Tài liệu đã được mở trong chế độ chỉ đọc',
  'file.encrypted_package_downloaded': 'Gói tài liệu mã hóa đã được tải xuống',
  'token.issued': 'Đã tạo thêm liên kết chia sẻ',
  'token.revoked': 'Đã thu hồi một liên kết',
  'vault.created': 'Đã tạo không gian nhóm',
  'vault.member_upserted': 'Đã cập nhật thành viên nhóm',
  'vault.member_removed': 'Đã xoá thành viên khỏi nhóm',
  'vault.threshold_configured': 'Đã bật quy trình nhiều người duyệt',
  'vault.threshold_disabled': 'Đã tắt quy trình nhiều người duyệt',
  'approval.requested': 'Có yêu cầu mở tài liệu',
  'approval.contributed': 'Một thành viên đã đồng ý',
  'file.destroyed': 'Đã huỷ tài liệu và toàn bộ quyền truy cập',
  'file.ciphertext_delete_failed': 'Đã thu hồi quyền nhưng chưa dọn được bản mã',
  'identity.registered': 'Đã thiết lập thiết bị tin cậy',
};

function relativeTime(value: string) {
  const seconds = Math.round((new Date(value).getTime() - Date.now()) / 1000);
  const formatter = new Intl.RelativeTimeFormat('vi', { numeric: 'auto' });
  if (Math.abs(seconds) < 60) return formatter.format(seconds, 'second');
  const minutes = Math.round(seconds / 60);
  if (Math.abs(minutes) < 60) return formatter.format(minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return formatter.format(hours, 'hour');
  return formatter.format(Math.round(hours / 24), 'day');
}

export default function DashboardOverview({ stats, events }: { stats: OverviewStats; events: ActivityEvent[] }) {
  const cards = [
    ['Tài liệu đã gửi', stats.sent, 'Do bạn sở hữu'],
    ['Được gửi cho bạn', stats.received, 'Còn quyền truy cập'],
    ['Đang chờ xử lý', stats.waiting, 'Cần bạn đồng ý'],
    ['Liên kết đang mở', stats.activeLinks, 'Có thể thu hồi'],
    ['Không gian nhóm', stats.workspaces, 'Bạn đang tham gia'],
  ] as const;

  return (
    <section className="dashboard-overview">
      <div className="overview-stats">
        {cards.map(([label, value, detail]) => (
          <article key={label}>
            <span>{label}</span>
            <strong>{String(value).padStart(2, '0')}</strong>
            <small>{detail}</small>
          </article>
        ))}
      </div>
      <div className="activity-feed">
        <div className="activity-feed-heading">
          <div>
            <span>Nhật ký hoạt động</span>
            <h2>Mọi thay đổi quan trọng đều được ghi lại.</h2>
          </div>
          <small>Không thể chỉnh sửa hoặc xoá</small>
        </div>
        <div className="activity-feed-list">
          {events.length === 0 ? (
            <div className="activity-feed-empty">Chưa có hoạt động nào được ghi lại.</div>
          ) : events.map((event) => (
            <article key={event.id}>
              <i className={event.outcome === 'success' ? 'success' : 'failure'} />
              <div>
                <strong>{actionLabels[event.action] || event.action}</strong>
                <span>{event.resourceId ? `Mã tham chiếu ${event.resourceId.slice(0, 8)}` : 'Tài khoản của bạn'}</span>
              </div>
              <time dateTime={event.createdAt}>{relativeTime(event.createdAt)}</time>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
