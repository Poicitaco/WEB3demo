"use client";

import { useEffect, useRef, useState } from 'react';
import { ethers } from 'ethers';
import type { Eip1193Provider } from 'ethers';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/Toast';

function short(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function addrHue(addr: string) {
  let h = 0;
  for (let i = 2; i < addr.length; i++) h = (h * 31 + addr.charCodeAt(i)) % 360;
  return h;
}

export default function AccountMenu() {
  const { address, setAddress } = useAuth();
  const { success, error: toastError, info } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
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
    const eth = (window as unknown as { ethereum?: Eip1193Provider | undefined }).ethereum;
    if (!eth) return;
    const onAccounts = async (accs: string[]) => {
      if (!accs || accs.length === 0) {
        await fetch('/api/auth/logout', { method: 'POST' });
        setAddress(null);
        info('Wallet disconnected');
        return;
      }
      try {
        const provider = new ethers.BrowserProvider(eth);
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
        success('Switched account');
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        toastError(msg);
      }
    };
    const onChain = (chainId: unknown) => {
      info(`Network changed (${String(chainId)})`);
    };
    (eth as any).on?.('accountsChanged', onAccounts);
    (eth as any).on?.('chainChanged', onChain);
    return () => {
      (eth as any).removeListener?.('accountsChanged', onAccounts);
      (eth as any).removeListener?.('chainChanged', onChain);
    };
  }, [setAddress, success, toastError, info]);

  const connect = async () => {
    setLoading(true);
    try {
      const eth = (window as unknown as { ethereum?: unknown }).ethereum;
      if (!eth) throw new Error('MetaMask not found');
      const provider = new ethers.BrowserProvider(eth as Eip1193Provider);
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
      success('Wallet connected');
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
      success('Signed out');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toastError(msg);
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    success('Address copied');
    setOpen(false);
  };

  const explorer = async () => {
    const eth = (window as unknown as { ethereum?: Eip1193Provider | undefined }).ethereum;
    let url = 'https://etherscan.io/address/';
    try {
      if (eth) {
        // @ts-ignore
        const chainIdHex = await (eth as any).request?.({ method: 'eth_chainId' });
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
      const eth = (window as any).ethereum;
      if (!eth) throw new Error('MetaMask not found');
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
      <button onClick={connect} disabled={loading} className="px-3 py-1.5 rounded bg-black text-white dark:bg-white dark:text-black text-sm">
        {loading ? 'Connecting…' : 'Connect Wallet'}
      </button>
    );
  }

  const hue = addrHue(address);
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-2 btn-secondary">
        <span className="inline-flex w-5 h-5 rounded-full" style={{ background: `conic-gradient(hsl(${hue} 80% 50%), hsl(${(hue+60)%360} 80% 50%))` }} />
        <span className="text-sm">{short(address)}</span>
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-56 glass p-2 text-sm">
          <div className="px-2 py-1 muted">Account</div>
          <button className="w-full text-left px-2 py-1 hover:text-accent-3" onClick={copy}>Copy address</button>
          <button className="w-full text-left px-2 py-1 hover:text-accent-3" onClick={explorer}>View on explorer</button>
          <button className="w-full text-left px-2 py-1 hover:text-accent-3" onClick={switchAccount}>Switch account</button>
          <a className="block px-2 py-1 hover:text-accent-3" href="/dashboard">My files</a>
          <div className="border-t border-[rgba(255,255,255,0.12)] my-1" />
          <button className="w-full text-left px-2 py-1 hover:text-accent-3" onClick={logout}>Sign out</button>
        </div>
      )}
    </div>
  );
}

