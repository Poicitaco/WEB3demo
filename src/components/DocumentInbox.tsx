"use client";

import Link from 'next/link';
import { useMemo, useState } from 'react';
import ChoiceSelect from '@/components/ChoiceSelect';
import { formatDateUtc } from '@/lib/dateFormat';

export type InboxDocument = {
  id: string;
  title: string | null;
  name: string | null;
  sizeBytes: number | null;
  createdAt: string;
  context: string | null;
  version?: number;
  token?: string;
  status?: string;
  progress?: string;
};

type InboxTab = 'sent' | 'received' | 'waiting';

function formatBytes(value: number | null) {
  if (!value || value <= 0) return 'Không rõ dung lượng';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = value;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit++;
  }
  return `${size.toFixed(1)} ${units[unit]}`;
}

export default function DocumentInbox({
  sent,
  received,
  waiting,
}: {
  sent: InboxDocument[];
  received: InboxDocument[];
  waiting: InboxDocument[];
}) {
  const [tab, setTab] = useState<InboxTab>('sent');
  const [query, setQuery] = useState('');
  const [context, setContext] = useState('all');
  const sourceRows = useMemo(() => ({ sent, received, waiting })[tab], [tab, sent, received, waiting]);
  const contexts = useMemo(
    () => Array.from(new Set(sourceRows.map((row) => row.context).filter(Boolean) as string[])),
    [sourceRows]
  );
  const rows = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('vi');
    return sourceRows.filter((row) => {
      const matchesQuery = !normalized || `${row.title || ''} ${row.name || ''} ${row.context || ''}`.toLocaleLowerCase('vi').includes(normalized);
      return matchesQuery && (context === 'all' || row.context === context);
    });
  }, [sourceRows, query, context]);

  const labels: Record<InboxTab, { title: string; empty: string }> = {
    sent: { title: 'Đã gửi', empty: 'Bạn chưa gửi tài liệu nào.' },
    received: { title: 'Được gửi cho bạn', empty: 'Chưa có tài liệu nào được gửi trực tiếp cho bạn.' },
    waiting: { title: 'Đang chờ bạn', empty: 'Không có tài liệu nào đang chờ bạn đồng ý.' },
  };

  function openManagement(tool: 'links' | 'approvals') {
    window.dispatchEvent(new CustomEvent('dashboard:tool', { detail: tool }));
  }

  return (
    <section className="document-inbox">
      <div className="inbox-heading">
        <div>
          <span>Tài liệu của bạn</span>
          <h2>Mọi việc cần chú ý, trong một hộp thư.</h2>
        </div>
        <Link href="/upload" className="btn-primary">Gửi tài liệu mới</Link>
      </div>

      <div className="inbox-tabs" role="tablist" aria-label="Nhóm tài liệu">
        {([
          ['sent', 'Đã gửi', sent.length],
          ['received', 'Được gửi cho bạn', received.length],
          ['waiting', 'Đang chờ bạn', waiting.length],
        ] as const).map(([id, label, count]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={tab === id ? 'active' : ''}
            onClick={() => {
              setTab(id);
              setContext('all');
            }}
          >
            <span>{label}</span>
            <strong>{String(count).padStart(2, '0')}</strong>
          </button>
        ))}
      </div>

      <div className="inbox-list">
        <div className="inbox-tools">
          <input
            className="input"
            type="search"
            placeholder="Tìm theo tên tài liệu hoặc không gian..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <ChoiceSelect
            ariaLabel="Lọc theo không gian"
            value={context}
            options={[
              { value: 'all', label: 'Tất cả không gian' },
              ...contexts.map((item) => ({ value: item, label: item })),
            ]}
            onChange={setContext}
          />
        </div>
        <div className="inbox-list-bar">
          <span>{labels[tab].title}</span>
          <small>{rows.length}/{sourceRows.length} tài liệu</small>
        </div>
        {rows.length === 0 ? (
          <div className="inbox-empty">
            <strong>Không có gì cần xử lý.</strong>
            <span>{labels[tab].empty}</span>
          </div>
        ) : rows.map((row) => (
          <article className="inbox-row" key={`${tab}-${row.id}`}>
            <div className="inbox-file-mark">{(row.name?.split('.').pop() || 'TỆP').slice(0, 4).toUpperCase()}</div>
            <div className="inbox-file-copy">
              <strong>{row.title || row.name || 'Tài liệu chưa đặt tên'}</strong>
              <span>{row.name || 'Tệp'} · {formatBytes(row.sizeBytes)}</span>
            </div>
            <div className="inbox-context">
              <span>{row.context || 'Cá nhân'}</span>
              <small>{row.progress || (row.version ? `Phiên bản ${row.version}` : 'Riêng tư')}</small>
            </div>
            <time dateTime={row.createdAt}>{formatDateUtc(row.createdAt)}</time>
            {row.token ? (
              <Link href={`/download?token=${encodeURIComponent(row.token)}`} className="inbox-action">Mở tài liệu ↗</Link>
            ) : tab === 'waiting' ? (
              <button type="button" className="inbox-action" onClick={() => openManagement('approvals')}>Xem yêu cầu ↓</button>
            ) : (
              <button type="button" className="inbox-action" onClick={() => openManagement('links')}>Quản lý liên kết ↓</button>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
