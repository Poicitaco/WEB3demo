"use client";

import { useEffect, useRef, useState } from 'react';
import type { Eip1193Provider } from 'ethers';
import dynamic from 'next/dynamic';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/Toast';

const EncryptionIdentityControl = dynamic(() => import('@/components/EncryptionIdentityControl'), {
  loading: () => <div className="account-menu-note">Đang tải định danh mã hoá...</div>,
});

type EthereumProvider = Eip1193Provider & {
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
};

function short(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export default function AccountMenu() {
  const { address, setAddress } = useAuth();
  const { success, error: toastError, info } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showIdentity, setShowIdentity] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, []);

  useEffect(() => {
    const eth = (window as unknown as { ethereum?: EthereumProvider }).ethereum;
    if (!eth) return;
    const onAccounts = async (accs: string[]) => {
      if (!accs || accs.length === 0) {
        await fetch('/api/auth/logout', { method: 'POST' });
        setAddress(null);
        info('Đã ngắt kết nối ví');
        return;
      }
      try {
        const { BrowserProvider } = await import('ethers');
        const provider = new BrowserProvider(eth);
        const signer = await provider.getSigner();
        const addr = (await signer.getAddress());
        const start = await fetch('/api/auth/start', { method: 'POST' }).then((r) => r.json());
        const sig = await signer.signMessage(start.message);
        const verify = await fetch('/api/auth/verify', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address: addr, signature: sig })
        }).then(r => r.json());
        if (!verify.ok) throw new Error(verify.error || 'Re-login failed');
        setAddress(addr);
        success('Đã chuyển tài khoản');
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        toastError(msg);
      }
    };
    const onChain = (chainId: unknown) => {
      info(`Đã đổi mạng (${String(chainId)})`);
    };
    eth.on?.('accountsChanged', onAccounts as (...args: unknown[]) => void);
    eth.on?.('chainChanged', onChain);
    return () => {
      eth.removeListener?.('accountsChanged', onAccounts as (...args: unknown[]) => void);
      eth.removeListener?.('chainChanged', onChain);
    };
  }, [setAddress, success, toastError, info]);

  const connect = async () => {
    setLoading(true);
    try {
      const eth = (window as unknown as { ethereum?: unknown }).ethereum;
      if (!eth) throw new Error('Không tìm thấy MetaMask');
      const { BrowserProvider } = await import('ethers');
      const provider = new BrowserProvider(eth as Eip1193Provider);
      await provider.send('eth_requestAccounts', []);
      const signer = await provider.getSigner();
      const addr = await signer.getAddress();
      const start = await fetch('/api/auth/start', { method: 'POST' }).then((r) => r.json());
      const sig = await signer.signMessage(start.message);
      const verify = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: addr, signature: sig }),
      }).then((r) => r.json());
      if (!verify.ok) throw new Error(verify.error || 'Login failed');
      setAddress(addr);
      success('Đã kết nối ví');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toastError(msg);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setAddress(null);
      success('Đã đăng xuất');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toastError(msg);
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      success('Đã sao chép địa chỉ');
    } catch {
      info(address);
    }
    setOpen(false);
  };

  const explorer = async () => {
    const eth = (window as unknown as { ethereum?: EthereumProvider }).ethereum;
    let url = 'https://etherscan.io/address/';
    try {
      if (eth) {
        const chainIdHex = await eth.request({ method: 'eth_chainId' });
        const chainId = parseInt(chainIdHex as string, 16);
        if (chainId === 1) url = 'https://etherscan.io/address/';
        else if (chainId === 11155111) url = 'https://sepolia.etherscan.io/address/';
        else if (chainId === 5) url = 'https://goerli.etherscan.io/address/';
        else if (chainId === 137) url = 'https://polygonscan.com/address/';
        else if (chainId === 8453) url = 'https://basescan.org/address/';
      }
    } catch {}
    if (address) window.open(url + address, '_blank');
    setOpen(false);
  };

  const switchAccount = async () => {
    setLoading(true);
    try {
      const eth = (window as unknown as { ethereum?: EthereumProvider }).ethereum;
      if (!eth) throw new Error('Không tìm thấy MetaMask');
      await eth.request?.({ method: 'wallet_requestPermissions', params: [{ eth_accounts: {} }] });
      await connect();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toastError(msg);
    } finally {
      setLoading(false);
      setOpen(false);
    }
  };

  if (!address) {
    return (
      <button type="button" onClick={connect} disabled={loading} className="btn-primary">
        {loading ? 'Đang kết nối...' : 'Kết nối ví'}
      </button>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label="Mở menu tài khoản"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="account-menu-trigger btn-secondary"
      >
        <span className="account-avatar" aria-hidden="true" />
        <span className="text-sm">{short(address)}</span>
      </button>
      {open && (
        <div className="account-popover absolute right-0 mt-2 w-80 glass allow-overflow p-2 text-sm" role="menu">
          <div className="account-menu-head">
            <span className="account-avatar large" aria-hidden="true" />
            <div>
              <strong>Tài khoản đang dùng</strong>
              <code>{short(address)}</code>
            </div>
          </div>
          <button type="button" role="menuitem" className="account-menu-item" onClick={copy}>Sao chép địa chỉ</button>
          <button type="button" role="menuitem" className="account-menu-item" onClick={explorer}>Xem trên explorer</button>
          <button type="button" role="menuitem" className="account-menu-item" onClick={switchAccount}>Chuyển tài khoản</button>
          <a role="menuitem" className="account-menu-item" href="/dashboard">Tệp của tôi</a>
          <button
            type="button"
            role="menuitem"
            className="account-menu-item"
            onClick={() => setShowIdentity((value) => !value)}
          >
            {showIdentity ? 'Ẩn định danh mã hoá' : 'Kiểm tra định danh mã hoá'}
          </button>
          {showIdentity && <EncryptionIdentityControl address={address} />}
          <div className="border-t border-[rgba(255,255,255,0.12)] my-1" />
          <button type="button" role="menuitem" className="account-menu-item danger" onClick={logout}>Đăng xuất</button>
        </div>
      )}
    </div>
  );
}

