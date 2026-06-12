"use client";

import { useState } from 'react';
import FileSelectCombobox from '@/components/FileSelectCombobox';
import { useToast } from '@/components/Toast';

type Version = {
  id: string;
  version_number: number;
  title: string | null;
  name: string | null;
  size_bytes: number | null;
  owner_address: string;
  created_at: string;
};

export default function VersionHistory() {
  const toast = useToast();
  const [fileId, setFileId] = useState('');
  const [versions, setVersions] = useState<Version[]>([]);

  async function loadVersions(id: string) {
    setFileId(id);
    if (!id) return setVersions([]);
    const response = await fetch(`/api/files/${id}/versions`);
    const data = await response.json();
    if (!response.ok || !data.ok) {
      setVersions([]);
      return toast.error(data.error || 'Failed to load versions');
    }
    setVersions(data.versions as Version[]);
  }

  return (
    <div className="glass p-4 space-y-3">
      <div className="text-sm font-semibold">File Version History</div>
      <FileSelectCombobox value={fileId} onChange={loadVersions} placeholder="Select a file to inspect versions..." />
      {versions.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left muted">
              <tr>
                <th className="py-2 pr-3">Version</th>
                <th className="py-2 pr-3">Filename</th>
                <th className="py-2 pr-3">Created</th>
                <th className="py-2 pr-3">ID</th>
              </tr>
            </thead>
            <tbody>
              {versions.map((version) => (
                <tr key={version.id} className="border-t border-[var(--card-border)]">
                  <td className="py-2 pr-3">v{version.version_number}</td>
                  <td className="py-2 pr-3">{version.name || version.title || 'file'}</td>
                  <td className="py-2 pr-3">{new Date(version.created_at).toLocaleString()}</td>
                  <td className="py-2 pr-3 font-mono text-xs">{version.id.slice(0, 8)}...</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
