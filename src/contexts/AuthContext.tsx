"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

type AuthValue = {
  address: string | null;
  walletAddress: string | null;
  walletAvailable: boolean;
  walletMismatch: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
  setAddress: (addr: string | null) => void;
};

const Ctx = createContext<AuthValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddressState] = useState<string | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [walletAvailable, setWalletAvailable] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      const addr = data.ok ? (data.address as string) : null;
      setAddressState(addr);
      if (addr) localStorage.setItem('address', addr); else localStorage.removeItem('address');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    try {
      const local = localStorage.getItem('address');
      if (local) setAddressState(local);
    } catch {}
    refresh();
  }, [refresh]);

  useEffect(() => {
    type Ethereum = {
      request?: (args: { method: string }) => Promise<unknown>;
      on?: (event: string, listener: (...args: unknown[]) => void) => void;
      removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
    };
    const ethereum = (window as unknown as { ethereum?: Ethereum }).ethereum;
    setWalletAvailable(Boolean(ethereum));
    if (!ethereum) return;
    const updateAccounts = (accounts: unknown) => {
      const first = Array.isArray(accounts) && typeof accounts[0] === 'string' ? accounts[0] : null;
      setWalletAddress(first);
    };
    ethereum.request?.({ method: 'eth_accounts' }).then(updateAccounts).catch(() => setWalletAddress(null));
    ethereum.on?.('accountsChanged', updateAccounts);
    return () => ethereum.removeListener?.('accountsChanged', updateAccounts);
  }, []);

  const setAddress = (addr: string | null) => {
    setAddressState(addr);
    try { if (addr) localStorage.setItem('address', addr); else localStorage.removeItem('address'); } catch {}
  };

  return (
    <Ctx.Provider value={{
      address,
      walletAddress,
      walletAvailable,
      walletMismatch: Boolean(address && walletAddress && address.toLowerCase() !== walletAddress.toLowerCase()),
      loading,
      refresh,
      setAddress,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth must be used within AuthProvider');
  return v;
}
