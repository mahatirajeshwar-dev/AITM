import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from './api';

type User = { id: string; fullName: string; email: string; emailVerified: boolean; role: string; batch?: string; phone?: string; profileImage?: string; contactPref?: string; accountStatus?: string } | null;
type Toast = { id: number; msg: string; type: 'success' | 'error' | 'info' };

const Ctx = createContext<any>(null);
export const useApp = () => useContext(Ctx);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User>(null);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [counts, setCounts] = useState({ notifications: 0, messages: 0 });

  const refresh = useCallback(async () => {
    try { const d = await api.get('/api/auth/me'); setUser(d.user); } catch { setUser(null); }
    setLoading(false);
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const refreshCounts = useCallback(async () => {
    try {
      const [n, m] = await Promise.all([api.get('/api/notifications'), api.get('/api/messages/unread-count')]);
      setCounts({ notifications: n.unread, messages: m.count });
    } catch { /* not logged in / unverified */ }
  }, []);
  useEffect(() => {
    if (user?.emailVerified) { refreshCounts(); const t = setInterval(refreshCounts, 20000); return () => clearInterval(t); }
  }, [user, refreshCounts]);

  const toast = useCallback((msg: string, type: Toast['type'] = 'success') => {
    const id = Date.now() + Math.random();
    setToasts(ts => [...ts, { id, msg, type }]);
    setTimeout(() => setToasts(ts => ts.filter(t => t.id !== id)), 4200);
  }, []);

  return <Ctx.Provider value={{ user, setUser, loading, refresh, toast, counts, refreshCounts }}>
    {children}
    <div className="fixed bottom-4 right-4 z-[100] space-y-2 max-w-sm">
      {toasts.map(t => (
        <div key={t.id} className={`rounded-xl px-4 py-3 text-sm font-medium shadow-lg text-white ${t.type === 'error' ? 'bg-red-600' : t.type === 'info' ? 'bg-slate-800' : 'bg-emerald-600'}`}>{t.msg}</div>
      ))}
    </div>
  </Ctx.Provider>;
}
