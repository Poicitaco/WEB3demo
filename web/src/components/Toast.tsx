"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

type Toast = { id: string; message: string; type?: 'success' | 'error' | 'info' };

type ToastValue = {
  toasts: Toast[];
  show: (msg: string, type?: Toast['type']) => void;
  success: (msg: string) => void;
  error: (msg: string) => void;
  info: (msg: string) => void;
};

const Ctx = createContext<ToastValue | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Record<string, number>>({});

  const remove = useCallback((id: string) => {
    setToasts((t) => t.filter((x) => x.id !== id));
    const h = timers.current[id];
    if (h) window.clearTimeout(h);
    delete timers.current[id];
  }, []);

  const show = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = crypto.randomUUID();
    setToasts((t) => [...t, { id, message, type }]);
    timers.current[id] = window.setTimeout(() => remove(id), 3500);
  }, [remove]);

  const api = useMemo<ToastValue>(() => ({
    toasts,
    show,
    success: (m: string) => show(m, 'success'),
    error: (m: string) => show(m, 'error'),
    info: (m: string) => show(m, 'info'),
  }), [toasts, show]);

  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="fixed top-4 right-4 z-[100] space-y-2 w-[320px]">
        {toasts.map((t) => (
          <div key={t.id} className={`glass p-3 text-sm border-l-2 ${t.type === 'success' ? 'border-l-emerald-400' : t.type === 'error' ? 'border-l-red-400' : 'border-l-cyan-400'}`}>
            <div className="flex items-start justify-between gap-3">
              <span>{t.message}</span>
              <button className="btn-secondary text-xs px-2 py-1" onClick={() => remove(t.id)}>Close</button>
            </div>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useToast must be used within ToastProvider');
  return v;
}

