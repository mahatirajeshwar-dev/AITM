import React, { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useApp } from '../lib/store';
import { api, timeAgo } from '../lib/api';

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2">
      <span className="h-9 w-9 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white grid place-items-center font-extrabold text-lg shadow-sm">S</span>
      <span className="leading-tight">
        <span className="block font-extrabold text-lg tracking-tight">SoMart</span>
        <span className="hidden sm:block text-[10px] text-slate-500 -mt-0.5">Your Campus. Your Marketplace.</span>
      </span>
    </Link>
  );
}

function Bell() {
  const { counts, refreshCounts } = useApp();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const nav = useNavigate();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('click', h); return () => document.removeEventListener('click', h);
  }, []);
  const toggle = async () => {
    if (!open) {
      const d = await api.get('/api/notifications'); setItems(d.notifications);
      api.post('/api/notifications/read').then(refreshCounts);
    }
    setOpen(!open);
  };
  return (
    <div className="relative" ref={ref}>
      <button onClick={toggle} className="relative p-2 rounded-xl hover:bg-slate-100" aria-label="Notifications">
        🔔{counts.notifications > 0 && <span className="absolute -top-0.5 -right-0.5 h-5 min-w-5 px-1 rounded-full bg-red-600 text-white text-[10px] grid place-items-center font-bold">{counts.notifications}</span>}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-auto card p-2 z-50">
          <p className="px-2 py-1 text-xs font-semibold text-slate-500">Notifications</p>
          {items.length === 0 && <p className="p-4 text-sm text-slate-500 text-center">No notifications yet.</p>}
          {items.map(n => (
            <button key={n.id} onClick={() => { setOpen(false); n.link && nav(n.link); }}
              className={`w-full text-left rounded-lg px-3 py-2 hover:bg-slate-50 ${!n.readAt ? 'bg-brand-50' : ''}`}>
              <p className="text-sm font-semibold">{n.title}</p>
              {n.body && <p className="text-xs text-slate-600 line-clamp-2">{n.body}</p>}
              <p className="text-[10px] text-slate-400 mt-0.5">{timeAgo(n.createdAt)}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, setUser, counts, toast } = useApp();
  const nav = useNavigate();
  const [menu, setMenu] = useState(false);
  const [q, setQ] = useState('');
  const logout = async () => { await api.post('/api/auth/logout'); setUser(null); toast('Logged out'); nav('/'); };
  const search = (e: React.FormEvent) => { e.preventDefault(); nav(`/marketplace?q=${encodeURIComponent(q)}`); setMenu(false); };
  const links = user ? (user.role === 'admin'
    ? [['/admin', 'Admin Dashboard']]
    : [['/marketplace', 'Marketplace'], ['/dashboard', 'Dashboard'], ['/messages', `Messages${counts.messages ? ` (${counts.messages})` : ''}`], ['/safety', 'Safety']])
    : [['/marketplace', 'Marketplace'], ['/safety', 'Safety']];

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center gap-4">
          <Logo />
          <form onSubmit={search} className="hidden md:block flex-1 max-w-md">
            <input className="input" placeholder="Search books, cycles, electronics…" value={q} onChange={e => setQ(e.target.value)} />
          </form>
          <nav className="hidden md:flex items-center gap-1 ml-auto">
            {links.map(([to, label]) => (
              <NavLink key={to} to={to} className={({ isActive }) => `px-3 py-2 rounded-xl text-sm font-medium ${isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100'}`}>{label}</NavLink>
            ))}
            {user ? <>
              {user.role !== 'admin' && <><Bell /><Link to="/create" className="btn-primary ml-1">+ Sell / Rent</Link></>}
              <Link to={user.role === 'admin' ? '/admin' : '/profile'} className="ml-1 h-9 w-9 rounded-full bg-brand-100 text-brand-700 grid place-items-center font-bold text-sm" title={user.fullName}>{user.fullName[0]}</Link>
              <button onClick={logout} className="btn-secondary ml-1">Logout</button>
            </> : <>
              <Link to="/login" className="btn-secondary ml-1">Login</Link>
              <Link to="/signup" className="btn-primary ml-1">Sign up</Link>
            </>}
          </nav>
          <button className="md:hidden ml-auto p-2 text-2xl" onClick={() => setMenu(!menu)} aria-label="Menu">☰</button>
        </div>
        {menu && (
          <div className="md:hidden border-t border-slate-200 bg-white p-4 space-y-2">
            <form onSubmit={search}><input className="input" placeholder="Search…" value={q} onChange={e => setQ(e.target.value)} /></form>
            {links.map(([to, label]) => <Link key={to} to={to} onClick={() => setMenu(false)} className="block px-3 py-2 rounded-xl font-medium hover:bg-slate-100">{label}</Link>)}
            {user ? <>
              {user.role !== 'admin' && <Link to="/create" onClick={() => setMenu(false)} className="btn-primary w-full">+ Sell / Rent</Link>}
              <Link to="/profile" onClick={() => setMenu(false)} className="block px-3 py-2 rounded-xl font-medium hover:bg-slate-100">Profile</Link>
              <button onClick={() => { logout(); setMenu(false); }} className="btn-secondary w-full">Logout</button>
            </> : <div className="flex gap-2">
              <Link to="/login" onClick={() => setMenu(false)} className="btn-secondary flex-1">Login</Link>
              <Link to="/signup" onClick={() => setMenu(false)} className="btn-primary flex-1">Sign up</Link>
            </div>}
          </div>
        )}
      </header>
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">{children}</main>
      <footer className="border-t border-slate-200 bg-white mt-8">
        <div className="max-w-7xl mx-auto px-4 py-6 text-center space-y-2">
          <p className="text-sm font-semibold">SoMart — Your Campus. Your Marketplace.</p>
          <p className="text-xs text-slate-500 max-w-2xl mx-auto">SoMart only facilitates connections between students. All payments and settlements are handled directly between users. The platform does not process or guarantee payments and is not responsible for payment-related disputes.</p>
          <Link to="/safety" className="text-xs text-brand-600 font-medium">Safety Guidelines</Link>
        </div>
      </footer>
    </div>
  );
}
