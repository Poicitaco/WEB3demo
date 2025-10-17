"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

type AuthValue = {
  address: string | null;
  loading: boolean;
  refresh: () => Promise<void>;
  setAddress: (addr: string | null) => void;
};

const Ctx = createContext<AuthValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddressState] = useState<string | null>(null);
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

  const setAddress = (addr: string | null) => {
    setAddressState(addr);
    try { if (addr) localStorage.setItem('address', addr); else localStorage.removeItem('address'); } catch {}
  };

  return (
    <Ctx.Provider value={{ address, loading, refresh, setAddress }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth must be used within AuthProvider');
  return v;
}
