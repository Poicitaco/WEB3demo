"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { formatDateUtc } from '@/lib/dateFormat';

type FileRow = {
  id: string;
  title: string | null;
  name: string | null;
  size_bytes: number | null;
  created_at: string;
  vault_name?: string | null;
  version_number?: number;
};

type Tag = 'all' | 'doc' | 'img' | 'vid' | 'aud' | 'arc' | 'oth';

const FILTERS: Array<{ key: Tag; label: string }> = [
  { key: 'all', label: 'Tất cả' },
  { key: 'doc', label: 'Tài liệu' },
  { key: 'img', label: 'Hình ảnh' },
  { key: 'vid', label: 'Video' },
  { key: 'aud', label: 'Âm thanh' },
  { key: 'arc', label: 'Tệp nén' },
  { key: 'oth', label: 'Khác' },
];

function formatBytes(n: number | null | undefined) {
  if (!n || n <= 0) return '-';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let x = n;
  while (x >= 1024 && i < units.length - 1) {
    x /= 1024;
    i++;
  }
  return `${x.toFixed(1)} ${units[i]}`;
}

function typeFromName(name?: string | null): Tag {
  const n = (name || '').toLowerCase();
  if (/(\.pdf|\.docx?|\.pptx?|\.xlsx?)$/.test(n)) return 'doc';
  if (/(\.png|\.jpg|\.jpeg|\.gif|\.webp|\.svg)$/.test(n)) return 'img';
  if (/(\.mp4|\.mov|\.mkv|\.webm)$/.test(n)) return 'vid';
  if (/(\.mp3|\.wav|\.flac|\.m4a|\.ogg)$/.test(n)) return 'aud';
  if (/(\.zip|\.rar|\.7z|\.tar|\.gz)$/.test(n)) return 'arc';
  return 'oth';
}

function markFor(name?: string | null) {
  return ({ doc: 'DOC', img: 'IMG', vid: 'VID', aud: 'AUD', arc: 'ZIP', oth: 'FILE', all: 'ALL' } as Record<Tag, string>)[typeFromName(name)];
}

export default function FileSelectCombobox({ value, onChange, placeholder = 'Chọn một tệp...', className = '', autoSelectFirst = false }: {
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  className?: string;
  autoSelectFirst?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<FileRow[]>([]);
  const [q, setQ] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);
  const [tag, setTag] = useState<Tag>('all');
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/files/list');
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Không thể tải danh sách tệp');
      setFiles(data.files as FileRow[]);
      if (autoSelectFirst && !value && data.files?.[0]?.id) onChange(data.files[0].id as string);
    } finally {
      setLoading(false);
    }
  }, [autoSelectFirst, onChange, value]);

  useEffect(() => { load(); }, [load]);

  const selected = useMemo(() => files.find((file) => file.id === value) || null, [files, value]);
  const filtered = useMemo(() => {
    const search = q.trim().toLowerCase();
    return files.filter((file) => {
      const matchesType = tag === 'all' || typeFromName(file.name) === tag;
      const matchesSearch = !search || (file.title || '').toLowerCase().includes(search) || (file.name || '').toLowerCase().includes(search) || file.id.toLowerCase().includes(search);
      return matchesType && matchesSearch;
    });
  }, [files, q, tag]);

  return (
    <div className={`file-combobox ${className}`} ref={rootRef}>
      <label className="label">Tệp</label>
      <button type="button" className="input combobox-trigger" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
        <span>{selected ? `${selected.title || selected.name || selected.id.slice(0, 8)} · v${selected.version_number || 1}` : placeholder}</span>
        <i className="combobox-chevron" aria-hidden="true" />
      </button>
      {open && (
        <div className="dropdown-panel file-dropdown">
          <div className="file-filter-row">
            {FILTERS.map((filter) => (
              <button type="button" key={filter.key} className={`chip ${tag === filter.key ? 'active' : ''}`} onClick={() => setTag(filter.key)}>{filter.label}</button>
            ))}
          </div>
          <input autoFocus placeholder="Tìm theo tên hoặc ID..." className="input combobox-search" value={q} onChange={(event) => {
            setQ(event.target.value);
            setActiveIndex(0);
          }} onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setActiveIndex((index) => Math.min(index + 1, filtered.length - 1));
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              setActiveIndex((index) => Math.max(index - 1, 0));
            } else if (event.key === 'Enter') {
              event.preventDefault();
              const item = filtered[activeIndex];
              if (item) {
                onChange(item.id);
                setOpen(false);
              }
            } else if (event.key === 'Escape') setOpen(false);
          }} />
          <div role="listbox" className="file-result-list">
            {loading && <div className="file-empty">Đang tải...</div>}
            {!loading && filtered.length === 0 && <div className="file-empty">Không có kết quả phù hợp</div>}
            {!loading && filtered.map((file, index) => (
              <button type="button" key={file.id} role="option" aria-selected={file.id === value} onMouseEnter={() => setActiveIndex(index)} onClick={() => {
                onChange(file.id);
                setOpen(false);
              }} className={`dropdown-item ${index === activeIndex ? 'active' : ''}`}>
                <span className="file-type-mark">{markFor(file.name)}</span>
                <span className="file-option-copy">
                  <strong>{file.title || file.name || file.id.slice(0, 8)} · v{file.version_number || 1}</strong>
                  <small>{file.name || 'Tệp'} · {formatBytes(file.size_bytes)} · {formatDateUtc(file.created_at)}</small>
                </span>
                <i aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
