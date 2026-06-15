"use client";

import { useCallback, useEffect, useState } from 'react';
import { useToast } from '@/components/Toast';
import ChoiceSelect from '@/components/ChoiceSelect';

type Vault = {
  id: string;
  name: string;
  description: string | null;
  role: 'owner' | 'editor' | 'viewer';
  member_count: number;
  file_count: number;
};

type Member = {
  address: string;
  role: 'owner' | 'editor' | 'viewer';
  createdAt: string;
  encryptionIdentity: { algorithm: string; publicKey: unknown } | null;
};

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
  const [threshold, setThreshold] = useState(2);
  const [policy, setPolicy] = useState<{ threshold: number; total_shares: number } | null>(null);

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

  const loadPolicy = useCallback(async (vaultId: string) => {
    const response = await fetch(`/api/vaults/${vaultId}/threshold`);
    const data = await response.json();
    if (response.ok && data.ok) {
      setPolicy(data.policy as { threshold: number; total_shares: number } | null);
      if (data.policy?.threshold) setThreshold(data.policy.threshold as number);
    }
  }, []);

  useEffect(() => { loadVaults(); }, [loadVaults]);
  useEffect(() => {
    if (selected) Promise.all([loadMembers(selected), loadPolicy(selected)]);
    else {
      setMembers([]);
      setPolicy(null);
    }
  }, [selected, loadMembers, loadPolicy]);

  async function createVault() {
    const response = await fetch('/api/vaults', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-csrf': await csrfToken() },
      body: JSON.stringify({ name }),
    });
    const data = await response.json();
    if (!response.ok || !data.ok) return toast.error(data.error || 'Không thể tạo kho');
    setName('');
    setSelected(data.vaultId as string);
    await loadVaults();
    toast.success('Đã tạo kho');
  }

  async function saveMember() {
    if (!selected) return;
    const response = await fetch(`/api/vaults/${selected}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-csrf': await csrfToken() },
      body: JSON.stringify({ memberAddress, role }),
    });
    const data = await response.json();
    if (!response.ok || !data.ok) return toast.error(data.error || 'Không thể thêm thành viên');
    setMemberAddress('');
    await Promise.all([loadMembers(selected), loadVaults(), loadPolicy(selected)]);
    toast.success('Đã lưu thành viên kho');
  }

  async function removeMember(address: string) {
    if (!selected) return;
    const response = await fetch(`/api/vaults/${selected}/members`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', 'x-csrf': await csrfToken() },
      body: JSON.stringify({ memberAddress: address }),
    });
    const data = await response.json();
    if (!response.ok || !data.ok) return toast.error(data.error || 'Không thể xoá thành viên');
    await Promise.all([loadMembers(selected), loadVaults(), loadPolicy(selected)]);
    toast.success('Đã xoá thành viên kho');
  }

  async function saveThresholdPolicy() {
    if (!selected) return;
    const response = await fetch(`/api/vaults/${selected}/threshold`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-csrf': await csrfToken() },
      body: JSON.stringify({ threshold }),
    });
    const data = await response.json();
    if (!response.ok || !data.ok) return toast.error(data.error || 'Không thể lưu chính sách ngưỡng');
    await loadPolicy(selected);
    toast.success('Đã bật chính sách phê duyệt theo ngưỡng');
  }

  async function disableThresholdPolicy() {
    if (!selected) return;
    const response = await fetch(`/api/vaults/${selected}/threshold`, {
      method: 'DELETE',
      headers: { 'x-csrf': await csrfToken() },
    });
    const data = await response.json();
    if (!response.ok || !data.ok) return toast.error(data.error || 'Không thể tắt chính sách ngưỡng');
    setPolicy(null);
    toast.success('Đã tắt chính sách phê duyệt theo ngưỡng');
  }

  const activeVault = vaults.find((vault) => vault.id === selected);

  return (
    <div className="glass p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">Kho cộng tác</div>
          <div className="text-xs muted">Chủ kho và biên tập viên quản lý tệp mã hoá. Người xem có thể kiểm tra siêu dữ liệu.</div>
        </div>
        <div className="vault-create-row">
          <input className="input" placeholder="Tên kho mới" value={name} onChange={(event) => setName(event.target.value)} />
          <button className="btn-primary whitespace-nowrap" disabled={!name.trim()} onClick={createVault}>Tạo kho</button>
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
            <div className="text-xs muted mt-1">{vault.role} | {vault.member_count} thành viên | {vault.file_count} tệp</div>
          </button>
        ))}
      </div>

      {activeVault && (
        <div className="border-t border-[var(--card-border)] pt-4 space-y-3">
          <div className="text-sm font-semibold">Thành viên của {activeVault.name}</div>
          {activeVault.role === 'owner' && (
            <div className="vault-member-form">
              <input className="input" placeholder="Địa chỉ 0x của thành viên" value={memberAddress} onChange={(event) => setMemberAddress(event.target.value)} />
              <ChoiceSelect
                ariaLabel="Vai trò thành viên"
                value={role}
                options={[
                  { value: 'viewer', label: 'Người xem' },
                  { value: 'editor', label: 'Biên tập viên' },
                ]}
                onChange={(value) => setRole(value as 'editor' | 'viewer')}
              />
              <button className="btn-secondary" disabled={!/^0x[a-fA-F0-9]{40}$/.test(memberAddress)} onClick={saveMember}>Thêm / cập nhật</button>
            </div>
          )}
          <div className="space-y-2">
            {members.map((member) => (
              <div key={member.address} className="flex items-center justify-between gap-3 text-xs">
                <code className="break-all">{member.address}</code>
                <div className="flex items-center gap-2">
                  <span className="badge">{member.role}</span>
                  <span className="badge">{member.encryptionIdentity ? 'khoá sẵn sàng' : 'thiếu khoá'}</span>
                  {activeVault.role === 'owner' && member.role !== 'owner' && (
                    <button className="btn-secondary text-xs" onClick={() => removeMember(member.address)}>Xoá</button>
                  )}
                </div>
              </div>
            ))}
          </div>
          {activeVault.role === 'owner' && (
            <div className="border-t border-[var(--card-border)] pt-3 space-y-2">
              <div className="text-sm font-semibold">Phê duyệt theo ngưỡng</div>
              <div className="text-xs muted">
                {policy
                  ? `Đang bật: cần ${policy.threshold} trên ${policy.total_shares} thành viên.`
                  : 'Đang tắt. Mọi thành viên phải bật định danh mã hoá trước khi có thể kích hoạt.'}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  className="input w-24"
                  type="number"
                  min={2}
                  max={members.length}
                  value={threshold}
                  onChange={(event) => setThreshold(Number(event.target.value))}
                />
                <button className="btn-secondary" onClick={saveThresholdPolicy}>Bật / cập nhật</button>
                {policy && <button className="btn-secondary" onClick={disableThresholdPolicy}>Tắt</button>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
