"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type FileRow = { id: string; title: string | null; name: string | null; size_bytes: number | null; created_at: string };

function formatBytes(n: number | null | undefined) {
  if (!n || n <= 0) return '-';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0; let x = n as number;
  while (x >= 1024 && i < units.length - 1) { x /= 1024; i++; }
  return `${x.toFixed(1)} ${units[i]}`;
}

type Tag = 'all' | 'doc' | 'img' | 'vid' | 'aud' | 'arc' | 'oth';

function typeFromName(name?: string | null): Tag {
  const n = (name || '').toLowerCase();
  if (/(\.pdf|\.docx?|\.pptx?|\.xlsx?)$/.test(n)) return 'doc';
  if (/(\.png|\.jpg|\.jpeg|\.gif|\.webp|\.svg)$/.test(n)) return 'img';
  if (/(\.mp4|\.mov|\.mkv|\.webm)$/.test(n)) return 'vid';
  if (/(\.mp3|\.wav|\.flac|\.m4a|\.ogg)$/.test(n)) return 'aud';
  if (/(\.zip|\.rar|\.7z|\.tar|\.gz)$/.test(n)) return 'arc';
  return 'oth';
}

function iconFor(name?: string | null) {
  const t = typeFromName(name);
  if (t === 'doc') return '📄';
  if (t === 'img') return '🖼️';
  if (t === 'vid') return '🎞️';
  if (t === 'aud') return '🎵';
  if (t === 'arc') return '🗜️';
  return '📦';
}

export default function FileSelectCombobox({
  value,
  onChange,
  placeholder,
  className = '',
  autoSelectFirst = false,
}: {
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  className?: string;
  autoSelectFirst?: boolean;
}) {
  const ph = placeholder || 'Select a file...';
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<FileRow[]>([]);
  const [q, setQ] = useState('');
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const [tag, setTag] = useState<Tag>('all');
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/files/list');
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to load files');
      setFiles(data.files as FileRow[]);
      if (autoSelectFirst && !value && data.files?.[0]?.id) onChange(data.files[0].id as string);
    } finally {
      setLoading(false);
    }
  }, [autoSelectFirst, onChange, value]);

  useEffect(() => { load(); }, [load]);

  const selected = useMemo(() => files.find((f) => f.id === value) || null, [files, value]);
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    let arr = files;
    if (tag !== 'all') arr = arr.filter((f) => typeFromName(f.name) === tag);
    if (!s) return arr;
    return arr.filter((f) => (f.title || '').toLowerCase().includes(s) || (f.name || '').toLowerCase().includes(s) || f.id.toLowerCase().includes(s));
  }, [files, q, tag]);

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex((i) => Math.min(i + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); const item = filtered[activeIndex]; if (item) { onChange(item.id); setOpen(false); } }
    else if (e.key === 'Escape') { setOpen(false); }
  }

  return (
    <div className={`relative ${className}`} ref={rootRef}>
      <label className="label">File</label>
      <div className="relative">
        <button
          type="button"
          className="input combobox-trigger w-full flex items-center justify-between"
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span className="truncate text-left">
            {selected ? (selected.title || selected.name || selected.id.slice(0, 8)) : ph}
          </span>
          <span className="text-xs ml-2">▾</span>
        </button>
        {open && (
          <div className="absolute left-0 right-0 mt-1 rounded-md shadow-xl dropdown-panel p-3 z-[60]">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              {[
                { k:'all', l:'All' },
                { k:'doc', l:'Docs' },
                { k:'img', l:'Images' },
                { k:'vid', l:'Video' },
                { k:'aud', l:'Audio' },
                { k:'arc', l:'Archives' },
                { k:'oth', l:'Other' },
              ].map((it) => (
                <button key={it.k} className={`chip ${tag===it.k ? 'active' : ''}`} onClick={() => setTag(it.k as Tag)}>
                  {it.l}
                </button>
              ))}
            </div>
            <input
              autoFocus
              placeholder={'Search by name or ID...'}
              className="input combobox-search mb-2"
              value={q}
              onChange={(e) => { setQ(e.target.value); setActiveIndex(0); }}
              onKeyDown={onKeyDown}
              role="combobox"
              aria-controls="file-combobox-list"
              aria-expanded={open}
            />
            <div id="file-combobox-list" role="listbox" className="max-h-64 overflow-auto">
              {loading && <div className="text-xs muted p-2">Loading...</div>}
              {!loading && filtered.length === 0 && (
                <div className="text-xs muted p-2">No results</div>
              )}
              {!loading && filtered.map((f, idx) => {
                const isActive = idx === activeIndex;
                const isSelected = f.id === value;
                return (
                  <div
                    key={f.id}
                    role="option"
                    aria-selected={isSelected}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onMouseDown={(e) => { e.preventDefault(); onChange(f.id); setOpen(false); }}
                    className={`dropdown-item ${isActive ? 'active' : ''}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-base">{iconFor(f.name)}</span>
                      <div>
                        <div className="text-sm">{f.title || f.name || f.id.slice(0,8)}</div>
                        <div className="text-[11px] meta">{f.name || 'file'} • {formatBytes(f.size_bytes)} • {new Date(f.created_at).toLocaleDateString()}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

