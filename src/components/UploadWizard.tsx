"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/contexts/AuthContext';
import type { EncryptionPublicJwk } from '@/lib/encryptionIdentity';
import ChoiceSelect from '@/components/ChoiceSelect';
import DurationPicker from '@/components/DurationPicker';
import { protectedViewKind, protectedViewLabel } from '@/lib/protectedView';

function bufToBase64(buf: ArrayBuffer) {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

type Step = 1 | 2 | 3;
type VaultOption = { id: string; name: string; role: 'owner' | 'editor' | 'viewer' };
type VaultMember = {
  address: string;
  encryptionIdentity: { publicKey: EncryptionPublicJwk } | null;
};
type VersionTarget = {
  id: string;
  title: string | null;
  name: string | null;
  vault_id: string | null;
  version_number: number;
};

function strengthLabel(pw: string) {
  const len = pw.length;
  const hasLower = /[a-z]/.test(pw);
  const hasUpper = /[A-Z]/.test(pw);
  const hasNum = /\d/.test(pw);
  const hasSym = /[^\w]/.test(pw);
  let score = 0;
  if (len >= 8) score++;
  if (len >= 12) score++;
  if (hasLower && hasUpper) score++;
  if (hasNum) score++;
  if (hasSym) score++;
  if (!pw) return { label: 'Tuỳ chọn', className: 'muted' } as const;
  if (score >= 4) return { label: 'Mạnh', className: 'text-cyan-300' } as const;
  if (score >= 2) return { label: 'Trung bình', className: 'text-yellow-300' } as const;
  return { label: 'Yếu', className: 'text-red-400' } as const;
}

const allowDemoRaw = process.env.NEXT_PUBLIC_ALLOW_DEMO_RAW_KEYS === 'true';

export default function UploadWizard() {
  const { address, walletMismatch } = useAuth();
  const toast = useToast();
  const [step, setStep] = useState<Step>(1);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState('');
  const [token, setToken] = useState('');
  const [description, setDescription] = useState('');
  const [ttl, setTtl] = useState<number>(1440);
  const [maxDownloads, setMaxDownloads] = useState<number>(0);
  const [accessMode, setAccessMode] = useState<'view' | 'download'>('view');
  const [passphrase, setPassphrase] = useState('');
  const [recipientAddress, setRecipientAddress] = useState('');
  const [vaultId, setVaultId] = useState('');
  const [vaults, setVaults] = useState<VaultOption[]>([]);
  const [vaultPolicy, setVaultPolicy] = useState<{ threshold: number; total_shares: number } | null>(null);
  const [vaultMembers, setVaultMembers] = useState<VaultMember[]>([]);
  const [parentFileId, setParentFileId] = useState('');
  const [versionTargets, setVersionTargets] = useState<VersionTarget[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!address) {
      setVaults([]);
      setVaultId('');
      return;
    }
    fetch('/api/vaults')
      .then((response) => response.json())
      .then((data) => {
        if (data.ok) setVaults((data.vaults as VaultOption[]).filter((vault) => vault.role !== 'viewer'));
      })
      .catch(() => setVaults([]));
    fetch('/api/files/list')
      .then((response) => response.json())
      .then((data) => {
        if (data.ok) setVersionTargets(data.files as VersionTarget[]);
      })
      .catch(() => setVersionTargets([]));
  }, [address]);

  useEffect(() => {
    if (!vaultId) {
      setVaultPolicy(null);
      setVaultMembers([]);
      return;
    }
    Promise.all([
      fetch(`/api/vaults/${vaultId}/threshold`).then((response) => response.json()),
      fetch(`/api/vaults/${vaultId}/members`).then((response) => response.json()),
    ]).then(([policyData, memberData]) => {
      setVaultPolicy(policyData.ok ? policyData.policy : null);
      setVaultMembers(memberData.ok ? memberData.members as VaultMember[] : []);
    }).catch(() => {
      setVaultPolicy(null);
      setVaultMembers([]);
    });
  }, [vaultId]);

  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) setFile(f);
    setDragActive(false);
  }, []);

  const onBrowse = () => inputRef.current?.click();

  const disabled = useMemo(() => {
    const titleOk = title.trim().length > 0;
    const recipientOk = /^0x[a-fA-F0-9]{40}$/.test(recipientAddress.trim());
    const passOk = Boolean(vaultPolicy) || allowDemoRaw || passphrase.trim().length > 0 || recipientOk;
    const connected = Boolean(address) && !walletMismatch;
    const viewSupported = !file || protectedViewKind(file.name, file.type) !== 'unsupported';
    return !file || !titleOk || !passOk || !connected || !viewSupported;
  }, [file, title, passphrase, recipientAddress, address, walletMismatch, vaultPolicy]);

  const onSubmit = async () => {
    if (!file) return;
    const recipient = recipientAddress.trim();
    if (recipient && !/^0x[a-fA-F0-9]{40}$/.test(recipient)) {
      setStatus('Nhập địa chỉ ví người nhận hợp lệ.');
      return;
    }
    if (!vaultPolicy && !allowDemoRaw && !passphrase.trim() && !recipient) {
      setStatus('Nhập mật khẩu hoặc ví người nhận.');
      return;
    }
    setStatus('Đang mã hoá...');
    setToken('');
    try {
      setStep(2);
      // Use globalThis.crypto for Web Crypto API (client-side only)
      const webCrypto = globalThis.crypto;
      if (!webCrypto || !webCrypto.subtle) {
        throw new Error('Trình duyệt không hỗ trợ Web Crypto API');
      }

      const plain = await file.arrayBuffer();
      const iv = webCrypto.getRandomValues(new Uint8Array(12));
      const key = await webCrypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
      const ciphertext = await webCrypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain);
      const rawKey = await webCrypto.subtle.exportKey('raw', key);

      setStatus('Đang tải lên...');
      const blob = new Blob([ciphertext], { type: 'application/octet-stream' });
      const form = new FormData();
      form.append('file', blob, 'ciphertext.bin');
      form.append('name', file.name);
      // Ensure CSRF cookie and header
      const csrfRes = await fetch('/api/csrf');
      const { csrf } = await csrfRes.json().catch(() => ({ csrf: '' }));
      const up = await fetch('/api/storage/upload', { method: 'POST', body: form, headers: { 'x-csrf': csrf } });
      if (up.status === 401) throw new Error('Hãy kết nối ví trước khi tải lên.');
      if (!up.ok) throw new Error(await up.text().catch(() => 'Tải lên thất bại'));
      const { cid } = (await up.json()) as { cid: string };

      setStatus('Đang lưu siêu dữ liệu...');
      let payload: Record<string, unknown> = {
        title: title || file.name,
        description,
        cid,
        fileName: file.name,
        mime: file.type || 'application/octet-stream',
        sizeBytes: file.size,
        iv: bufToBase64(iv.buffer),
        ttlMinutes: ttl,
        maxDownloads: maxDownloads > 0 ? maxDownloads : undefined,
        accessMode,
        vaultId: vaultId || undefined,
        parentFileId: parentFileId || undefined,
      };
      if (vaultPolicy) {
        const { encryptThresholdShares, splitSecret } = await import('@/lib/clientThresholdShares');
        if (vaultMembers.length !== vaultPolicy.total_shares || vaultMembers.some((member) => !member.encryptionIdentity)) {
          throw new Error('Các thành viên của chính sách ngưỡng chưa sẵn sàng');
        }
        setStatus('Đang tạo các mảnh khoá ngưỡng được mã hoá...');
        const shares = splitSecret(rawKey, vaultPolicy.total_shares, vaultPolicy.threshold);
        const encryptedShares = await encryptThresholdShares(
          shares,
          vaultMembers.map((member) => ({
            address: member.address,
            publicKey: member.encryptionIdentity!.publicKey,
          }))
        );
        payload = {
          ...payload,
          thresholdShares: encryptedShares.map((share) => ({
            memberAddress: share.recipientAddress,
            shareIndex: share.shareIndex,
            envelope: share.envelope,
          })),
        };
      } else if (recipient) {
        const { wrapFileKeyForRecipient } = await import('@/lib/clientRecipientEnvelope');
        setStatus('Đang mã hoá khoá cho người nhận...');
        const identityResponse = await fetch(`/api/identities/${encodeURIComponent(recipient)}`);
        const identityData = await identityResponse.json();
        if (!identityResponse.ok || !identityData.ok) {
          throw new Error('Người nhận cần bật định danh mã hoá trước');
        }
        const recipientPublicKey = identityData.identity.publicKey as EncryptionPublicJwk;
        const recipientEnvelope = await wrapFileKeyForRecipient(rawKey, recipientPublicKey);
        payload = { ...payload, recipientAddress: recipient, recipientEnvelope };
      } else if (passphrase.trim()) {
        const enc = new TextEncoder();
        const webCrypto = globalThis.crypto;
        if (!webCrypto || !webCrypto.subtle) throw new Error('Trình duyệt không hỗ trợ Web Crypto API');
        const salt = webCrypto.getRandomValues(new Uint8Array(16));
        const baseKey = await webCrypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
        const wrapKey = await webCrypto.subtle.deriveKey(
          { name: 'PBKDF2', salt, iterations: 200000, hash: 'SHA-256' },
          baseKey,
          { name: 'AES-GCM', length: 256 },
          true,
          ['encrypt', 'decrypt']
        );
        const ivWrap = webCrypto.getRandomValues(new Uint8Array(12));
        const wrapped = await webCrypto.subtle.encrypt({ name: 'AES-GCM', iv: ivWrap }, wrapKey, rawKey);
        payload = {
          ...payload,
          salt: bufToBase64(salt.buffer),
          ivWrap: bufToBase64(ivWrap.buffer),
          wrappedKey: bufToBase64(wrapped),
        };
      } else if (allowDemoRaw) {
        payload = { ...payload, rawKeyBase64: bufToBase64(rawKey) };
      }
      const res = await fetch('/api/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf': csrf },
        body: JSON.stringify(payload),
      });
      if (res.status === 401) throw new Error('Hãy kết nối ví để lưu siêu dữ liệu tệp.');
      if (!res.ok) throw new Error(await res.text().catch(() => 'Lưu siêu dữ liệu thất bại'));
      const data = (await res.json()) as { token: string };
      setToken(data.token);
      setStatus('Hoàn tất');
      toast.success('Tải lên hoàn tất');
      setStep(3);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setStatus('Lỗi: ' + msg);
      toast.error(msg);
      setStep(1);
    }
  };

  return (
    <div className="glass p-5 sm:p-6" aria-live="polite">
      {!address && (
        <div className="connection-required">
          <strong>Kết nối ví để gửi tài liệu</strong>
          <span>Ví xác nhận bạn là chủ tài liệu và cho phép bạn quản lý hoặc thu hồi liên kết sau khi gửi.</span>
        </div>
      )}
      {walletMismatch && (
        <div className="connection-required danger">
          <strong>Tài khoản ví không khớp</strong>
          <span>Kết nối lại bằng tài khoản đang đăng nhập trước khi gửi tài liệu.</span>
        </div>
      )}
      {/* Step tabs */}
      <div className="mb-6">
        <div className="grid grid-cols-3 gap-3 text-xs font-medium">
          {[{ n: 1, t: 'Thông tin' }, { n: 2, t: 'Mã hoá và tải lên' }, { n: 3, t: 'Chia sẻ' }].map((s) => (
            <div
              key={s.n}
              className={`h-1.5 rounded-full ${step >= (s.n as Step) ? 'bg-gradient-to-r from-[var(--accent-1)] to-[var(--accent-3)]' : 'bg-[rgba(255,255,255,0.08)]'}`}
              title={s.t}
            />
          ))}
        </div>
        <div className="mt-2 grid grid-cols-3 text-[11px] muted">
          <div>Thông tin</div>
          <div className="text-center">Mã hoá và tải lên</div>
          <div className="text-right">Chia sẻ</div>
        </div>
      </div>

      {/* Two column layout */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* Dropzone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={onDrop}
          className={`relative rounded-xl transition-colors p-6 flex flex-col items-center justify-center min-h-[260px] text-center border ${dragActive ? 'border-[var(--accent-3)]' : 'border-[rgba(255,255,255,0.18)] border-dashed hover:border-[rgba(255,255,255,0.35)]'}`}
        >
          <input ref={inputRef} type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          <div className="text-sm mb-3">Thả tệp vào đây</div>
          <div className="text-xs muted mb-4">hoặc</div>
          <button type="button" className="btn-secondary" onClick={onBrowse}>
            Chọn tệp
          </button>
          <div className="text-[11px] muted mt-4">Tối đa khoảng 20MB cho bản demo</div>
          {file && (
            <div className="mt-4 text-xs">
              <div className="font-mono">{file.name}</div>
              <div className="muted">{(file.size / 1024 / 1024).toFixed(2)} MB</div>
            </div>
          )}
        </div>

        {/* Right form */}
        <div className="space-y-4">
          <div>
            <div className="text-sm font-semibold">Thông tin cơ bản</div>
            <div className="mt-2 text-xs muted">Đặt tên để bạn dễ nhận ra tài liệu này sau khi gửi.</div>
          </div>

          <label className="label">Tiêu đề</label>
          <input
            placeholder="Tài liệu được mã hoá của tôi"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="input"
          />

          <label className="label">Mô tả</label>
          <textarea
            placeholder="Ghi chú tuỳ chọn về tệp này"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="textarea"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <DurationPicker value={ttl} onChange={setTtl} label="Liên kết còn hiệu lực trong" />
            <div>
              <label className="label">Yêu cầu mật khẩu khi mở</label>
              <input type="password" placeholder="Tuỳ chọn - tăng mức bảo mật" value={passphrase} onChange={(e) => setPassphrase(e.target.value)} className="input" />
              <div className="text-[11px] muted mt-1 flex items-center gap-2">
                <span>Người nhận cần nhập đúng mật khẩu để mở tài liệu.</span>
                <span className={`badge ${strengthLabel(passphrase).className}`}>{strengthLabel(passphrase).label}</span>
              </div>
              {!vaultPolicy && !allowDemoRaw && !recipientAddress.trim() && <div className="text-[11px] text-yellow-300 mt-1">Cần mật khẩu hoặc ví người nhận.</div>}
            </div>
          </div>

          <div>
            <label className="label">Cách người nhận sử dụng tài liệu</label>
            <div className="access-mode-grid">
              <button type="button" className={accessMode === 'view' ? 'active' : ''} onClick={() => setAccessMode('view')}>
                <strong>Chỉ đọc được kiểm soát</strong>
                <span>Hiển thị trong trình xem, gắn watermark và không cung cấp nút tải file.</span>
              </button>
              <button type="button" className={accessMode === 'download' ? 'active' : ''} onClick={() => setAccessMode('download')}>
                <strong>Cho phép tải gói mã hóa</strong>
                <span>Vẫn xem bằng Viewer; tệp tải về là gói `.vaultline`, không phải bản gốc.</span>
              </button>
            </div>
            {accessMode === 'view' && <div className="text-[11px] muted mt-1">Phù hợp hơn cho bản thảo và bài báo khoa học cần theo dõi người đọc.</div>}
            {accessMode === 'view' && file && (
              <div className={`viewer-support ${protectedViewKind(file.name, file.type) === 'unsupported' ? 'unsupported' : ''}`}>
                <strong>{protectedViewLabel(protectedViewKind(file.name, file.type))}</strong>
                <span>{protectedViewKind(file.name, file.type) === 'unsupported' ? 'Hãy chuyển file sang PDF hoặc định dạng Viewer hỗ trợ.' : 'Có trình đọc bảo vệ cho định dạng này.'}</span>
              </div>
            )}
          </div>

          <div>
            <label className="label">Tự huỷ sau số lượt {accessMode === 'view' ? 'mở' : 'tải'}</label>
            <input
              className="input"
              type="number"
              min={0}
              max={10000}
              value={maxDownloads}
              onChange={(event) => setMaxDownloads(Math.max(0, parseInt(event.target.value || '0', 10)))}
              disabled={Boolean(vaultPolicy)}
            />
            <div className="text-[11px] muted mt-1">
              Nhập 0 để không giới hạn. Bản mã sẽ bị xoá sau lượt {accessMode === 'view' ? 'mở' : 'tải'} cuối cùng được cho phép.
            </div>
            {vaultPolicy && <div className="text-[11px] text-yellow-300 mt-1">Chưa hỗ trợ cho tệp được bảo vệ theo ngưỡng.</div>}
          </div>

          <div>
            <label className="label">Chỉ cho phép một người nhận</label>
            <input
              type="text"
              placeholder="Địa chỉ 0x người nhận, không bắt buộc"
              value={recipientAddress}
              onChange={(e) => setRecipientAddress(e.target.value)}
              className="input"
            />
            <div className="text-[11px] muted mt-1">
              Khi thiết lập, chỉ tài khoản này có thể mở tài liệu. Mật khẩu sẽ không được sử dụng.
            </div>
          </div>

          <div>
            <label className="label">Quản lý phiên bản</label>
            <ChoiceSelect
              ariaLabel="Quản lý phiên bản"
              value={parentFileId}
              options={[
                { value: '', label: 'Tạo một tệp mới', description: 'Bắt đầu một lịch sử phiên bản riêng' },
                ...versionTargets.map((target) => ({
                  value: target.id,
                  label: target.title || target.name || target.id.slice(0, 8),
                  description: `Tạo phiên bản tiếp theo từ v${target.version_number}`,
                })),
              ]}
              onChange={(nextParent) => {
                setParentFileId(nextParent);
                const target = versionTargets.find((candidate) => candidate.id === nextParent);
                if (target) {
                  setVaultId(target.vault_id || '');
                  setTitle(target.title || target.name || '');
                }
              }}
            />
            <div className="text-[11px] muted mt-1">Mỗi phiên bản được lưu riêng để bạn có thể xem lại lịch sử thay đổi.</div>
          </div>

          <div>
            <label className="label">Đích lưu trữ</label>
            <ChoiceSelect
              ariaLabel="Đích lưu trữ"
              value={vaultId}
              disabled={Boolean(parentFileId)}
              options={[
                { value: '', label: 'Tệp cá nhân', description: 'Chỉ bạn quản lý tệp này' },
                ...vaults.map((vault) => ({
                  value: vault.id,
                  label: vault.name,
                  description: vault.role === 'owner' ? 'Bạn là chủ kho' : 'Bạn là biên tập viên',
                })),
              ]}
              onChange={setVaultId}
            />
            <div className="text-[11px] muted mt-1">Chủ kho và biên tập viên có thể tải tệp mã hoá lên.</div>
            {vaultPolicy && (
              <div className="text-[11px] text-cyan-300 mt-1">
                Tài liệu cần {vaultPolicy.threshold} trên {vaultPolicy.total_shares} thành viên đồng ý trước khi được mở.
              </div>
            )}
          </div>

          <div className="pt-2">
            <button aria-label="Encrypt & Upload" className="btn-primary" disabled={disabled} onClick={onSubmit}>
              {step === 2 ? 'Đang xử lý...' : 'Mã hoá và tải lên'}
            </button>
            {!address && <span className="text-[11px] text-yellow-300 ml-3">Kết nối ví để lưu</span>}
          </div>

          {status && <div className="text-xs muted">{status}</div>}

          {token && (
            <div className="text-sm">
              <div className="muted text-xs mb-1">Mã truy cập</div>
              <div className="glass p-3 rounded-md flex items-center justify-between gap-3">
                <code className="text-xs break-all">{token}</code>
                <button
                  className="btn-secondary text-xs"
                  onClick={async () => {
                    await navigator.clipboard.writeText(token);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1200);
                  }}
                >
                  Sao chép
                </button>
              </div>
              <div className="muted text-[11px] mt-1">Gửi mã này hoặc liên kết bên dưới cho người nhận.</div>
              <div className="mt-3 flex gap-2">
                <a aria-label="Open download" className="btn-primary text-xs" href={`/download?token=${encodeURIComponent(token)}`}>
                  Mở liên kết nhận tệp
                </a>
                <button
                  className="btn-secondary text-xs"
                  onClick={async () => {
                    await navigator.clipboard.writeText(`${location.origin}/download?token=${encodeURIComponent(token)}`);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1200);
                  }}
                >
                  Sao chép liên kết
                </button>
              </div>
              {copied && <div className="text-[11px] text-cyan-300 mt-1">Đã sao chép vào bộ nhớ tạm</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
