"use client";

import { useCallback, useEffect, useState } from 'react';
import { useToast } from '@/components/Toast';

type Vault = {
  id: string;
  name: string;
  description: string | null;
  role: 'owner' | 'editor' | 'viewer';
  member_count: number;
  file_count: number;
};

type Member = { address: string; role: 'owner' | 'editor' | 'viewer'; created_at: string };

async function csrfToken() {
  const response = await fetch('/api/csrf');
  return (await response.json()).csrf as string;
}

export default function VaultManager() {
  const toast = useToast();
  const [vaults, setVaults] = useState<Vault[]>([]);
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [memberAddress, setMemberAddress] = useState('');
  const [role, setRole] = useState<'editor' | 'viewer'>('viewer');

  const loadVaults = useCallback(async () => {
    const response = await fetch('/api/vaults');
    const data = await response.json();
    if (response.ok && data.ok) setVaults(data.vaults as Vault[]);
  }, []);

  const loadMembers = useCallback(async (vaultId: string) => {
    const response = await fetch(`/api/vaults/${vaultId}/members`);
    const data = await response.json();
    if (response.ok && data.ok) setMembers(data.members as Member[]);
  }, []);

  useEffect(() => { loadVaults(); }, [loadVaults]);
  useEffect(() => {
    if (selected) loadMembers(selected);
    else setMembers([]);
  }, [selected, loadMembers]);

  async function createVault() {
    const response = await fetch('/api/vaults', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-csrf': await csrfToken() },
      body: JSON.stringify({ name }),
    });
    const data = await response.json();
    if (!response.ok || !data.ok) return toast.error(data.error || 'Failed to create vault');
    setName('');
    setSelected(data.vaultId as string);
    await loadVaults();
    toast.success('Vault created');
  }

  async function saveMember() {
    if (!selected) return;
    const response = await fetch(`/api/vaults/${selected}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-csrf': await csrfToken() },
      body: JSON.stringify({ memberAddress, role }),
    });
    const data = await response.json();
    if (!response.ok || !data.ok) return toast.error(data.error || 'Failed to add member');
    setMemberAddress('');
    await Promise.all([loadMembers(selected), loadVaults()]);
    toast.success('Vault member saved');
  }

  async function removeMember(address: string) {
    if (!selected) return;
    const response = await fetch(`/api/vaults/${selected}/members`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', 'x-csrf': await csrfToken() },
      body: JSON.stringify({ memberAddress: address }),
    });
    const data = await response.json();
    if (!response.ok || !data.ok) return toast.error(data.error || 'Failed to remove member');
    await Promise.all([loadMembers(selected), loadVaults()]);
    toast.success('Vault member removed');
  }

  const activeVault = vaults.find((vault) => vault.id === selected);

  return (
    <div className="glass p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">Collaborative Vaults</div>
          <div className="text-xs muted">Owners and editors manage encrypted files. Viewers can inspect vault metadata.</div>
        </div>
        <div className="flex gap-2">
          <input className="input" placeholder="New vault name" value={name} onChange={(event) => setName(event.target.value)} />
          <button className="btn-primary whitespace-nowrap" disabled={!name.trim()} onClick={createVault}>Create Vault</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {vaults.map((vault) => (
          <button
            key={vault.id}
            className={`text-left p-3 rounded-xl border ${selected === vault.id ? 'border-[var(--accent-3)]' : 'border-[var(--card-border)]'}`}
            onClick={() => setSelected(vault.id)}
          >
            <div className="font-semibold">{vault.name}</div>
            <div className="text-xs muted mt-1">{vault.role} | {vault.member_count} members | {vault.file_count} files</div>
          </button>
        ))}
      </div>

      {activeVault && (
        <div className="border-t border-[var(--card-border)] pt-4 space-y-3">
          <div className="text-sm font-semibold">{activeVault.name} members</div>
          {activeVault.role === 'owner' && (
            <div className="grid grid-cols-1 md:grid-cols-[1fr_140px_auto] gap-2">
              <input className="input" placeholder="Member 0x address" value={memberAddress} onChange={(event) => setMemberAddress(event.target.value)} />
              <select className="input" value={role} onChange={(event) => setRole(event.target.value as 'editor' | 'viewer')}>
                <option value="viewer">Viewer</option>
                <option value="editor">Editor</option>
              </select>
              <button className="btn-secondary" onClick={saveMember}>Add / Update</button>
            </div>
          )}
          <div className="space-y-2">
            {members.map((member) => (
              <div key={member.address} className="flex items-center justify-between gap-3 text-xs">
                <code className="break-all">{member.address}</code>
                <div className="flex items-center gap-2">
                  <span className="badge">{member.role}</span>
                  {activeVault.role === 'owner' && member.role !== 'owner' && (
                    <button className="btn-secondary text-xs" onClick={() => removeMember(member.address)}>Remove</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
