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
    setToasts((current) => [...current.filter((toast) => toast.message !== message), { id, message, type }].slice(-4));
    timers.current[id] = window.setTimeout(() => remove(id), 3500);
  }, [remove]);

  const api = useMemo<ToastValue>(() => ({
    toasts,
    show,
    success: (m: string) => show(m, 'success'),
    error: (m: string) => show(m, 'error'),
    info: (m: string) => show(m, 'info'),
  }), [toasts, show]);

  useEffect(() => () => {
    Object.values(timers.current).forEach((timer) => window.clearTimeout(timer));
  }, []);

  const labels = {
    success: 'Hoàn tất',
    error: 'Không thể thực hiện',
    info: 'Thông báo',
  } as const;

  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="toast-stack" aria-live="polite" aria-atomic="false">
        {toasts.map((t) => (
          <div key={t.id} className={`toast-item ${t.type || 'info'}`} role={t.type === 'error' ? 'alert' : 'status'}>
            <div className="toast-symbol" aria-hidden="true"><i /></div>
            <div className="toast-copy">
              <strong>{labels[t.type || 'info']}</strong>
              <span>{t.message}</span>
            </div>
            <button className="toast-close" aria-label="Đóng thông báo" onClick={() => remove(t.id)}>×</button>
            <span className="toast-progress" aria-hidden="true" />
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

