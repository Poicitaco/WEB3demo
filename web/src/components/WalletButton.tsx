"use client";

import { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import type { Eip1193Provider } from 'ethers';

export default function WalletButton() {
  const [address, setAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // no-op: could try to detect existing session
  }, []);

  const connect = async () => {
    setLoading(true);
    setError(null);
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
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {address ? (
        <span className="text-sm">{address.slice(0, 6)}…{address.slice(-4)}</span>
      ) : (
        <button
          onClick={connect}
          disabled={loading}
          className="px-3 py-1.5 rounded bg-black text-white dark:bg-white dark:text-black text-sm"
        >
          {loading ? 'Connecting…' : 'Connect Wallet'}
        </button>
      )}
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
}
