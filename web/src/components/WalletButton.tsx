"use client";

import { ethers } from 'ethers';
import type { Eip1193Provider } from 'ethers';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/Toast';
import { useState } from 'react';

export default function WalletButton() {
  const { address, setAddress, refresh } = useAuth();
  const { success, error: toastError } = useToast();
  const [loading, setLoading] = useState(false);

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
      await refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toastError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {address ? (
        <>
          <span className="text-sm">{address.slice(0, 6)}…{address.slice(-4)}</span>
          <button onClick={logout} disabled={loading} className="btn-secondary text-xs">Sign out</button>
        </>
      ) : (
        <button
          onClick={connect}
          disabled={loading}
          className="px-3 py-1.5 rounded bg-black text-white dark:bg-white dark:text-black text-sm"
        >
          {loading ? 'Connecting…' : 'Connect Wallet'}
        </button>
      )}
    </div>
  );
}
