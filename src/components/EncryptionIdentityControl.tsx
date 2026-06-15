"use client";

import { useCallback, useEffect, useState } from 'react';
import type { Eip1193Provider } from 'ethers';
import {
  generateLocalEncryptionIdentity,
  getLocalEncryptionIdentity,
  getOrCreateLocalEncryptionIdentity,
  saveLocalEncryptionIdentity,
} from '@/lib/clientEncryptionIdentity';
import { encryptionIdentityMessage } from '@/lib/encryptionIdentity';
import { useToast } from '@/components/Toast';

type IdentityState = 'checking' | 'ready' | 'mismatch' | 'server-only' | 'local-only' | 'missing';

export default function EncryptionIdentityControl({ address }: { address: string }) {
  const toast = useToast();
  const [state, setState] = useState<IdentityState>('checking');
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setState('checking');
    const [local, serverResponse] = await Promise.all([
      getLocalEncryptionIdentity(address),
      fetch(`/api/identities/${encodeURIComponent(address)}`).catch(() => null),
    ]);
    const server = serverResponse?.ok ? await serverResponse.json() : null;
    const serverKey = server?.identity?.publicKey as { x?: string; y?: string } | undefined;
    const keysMatch = Boolean(
      local && serverKey &&
      local.publicKey.x === serverKey.x &&
      local.publicKey.y === serverKey.y
    );
    setState(
      keysMatch ? 'ready' :
      local && server ? 'mismatch' :
      server ? 'server-only' :
      local ? 'local-only' :
      'missing'
    );
  }, [address]);

  useEffect(() => {
    refresh().catch(() => setState('missing'));
  }, [refresh]);

  async function register(generateNew = false) {
    setLoading(true);
    try {
      const ethereum = (window as unknown as { ethereum?: Eip1193Provider }).ethereum;
      if (!ethereum) throw new Error('Không tìm thấy MetaMask');
      const identity = generateNew
        ? await generateLocalEncryptionIdentity(address)
        : await getOrCreateLocalEncryptionIdentity(address);
      const { BrowserProvider } = await import('ethers');
      const signer = await new BrowserProvider(ethereum).getSigner();
      const signerAddress = await signer.getAddress();
      if (signerAddress.toLowerCase() !== address.toLowerCase()) {
        throw new Error('Ví đang kết nối không khớp với tài khoản này');
      }
      const signature = await signer.signMessage(encryptionIdentityMessage(address, identity.publicKey));
      const csrf = await fetch('/api/csrf').then((res) => res.json()).then((data) => data.csrf as string);
      const response = await fetch('/api/identities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf': csrf },
        body: JSON.stringify({ publicKey: identity.publicKey, signature }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || 'Đăng ký định danh thất bại');
      if (generateNew) await saveLocalEncryptionIdentity(identity);
      setState('ready');
      toast.success(generateNew ? 'Đã tạo định danh mã hoá cho thiết bị' : 'Đã bật định danh mã hoá');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }

  const status = {
    checking: 'Đang kiểm tra định danh mã hoá...',
    ready: 'Định danh mã hoá đã sẵn sàng trên thiết bị này',
    mismatch: 'Khoá thiết bị không khớp với khoá công khai đã đăng ký',
    'server-only': 'Khoá công khai tồn tại nhưng thiết bị này không có khoá riêng',
    'local-only': 'Khoá thiết bị tồn tại nhưng chưa được đăng ký',
    missing: 'Định danh mã hoá chưa được bật',
  }[state];

  return (
    <div className="px-2 py-2 border-t border-[rgba(255,255,255,0.12)] mt-1">
      <div className="text-[11px] muted mb-2">{status}</div>
      {state !== 'ready' && state !== 'checking' && (
        <button
          className="btn-secondary text-xs w-full"
          disabled={loading}
          onClick={() => register(state === 'server-only')}
        >
          {loading ? 'Đang đăng ký...' : state === 'server-only' || state === 'mismatch' ? 'Thay bằng khoá thiết bị' : 'Bật mã hoá'}
        </button>
      )}
    </div>
  );
}
