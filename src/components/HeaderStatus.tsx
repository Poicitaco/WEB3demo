"use client";

import { useAuth } from '@/contexts/AuthContext';

export default function HeaderStatus() {
  const { address } = useAuth();
  if (!address) return null;
  return (
    <div className="hidden sm:block text-xs muted">Connected: {address.slice(0, 10)}…</div>
  );
}
