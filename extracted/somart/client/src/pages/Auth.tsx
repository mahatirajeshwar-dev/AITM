import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { api } from '../lib/api';
import { useApp } from '../lib/store';

function Shell({ title, sub, children }: any) {
  return (
    <div className="max-w-md mx-auto mt-6">
      <div className="card p-8">
        <h1 className="text-2xl font-extrabold">{title}</h1>
        {sub && <p className="text-slate-500 text-sm mt-1">{sub}</p>}
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}
const Err = ({ e }: { e: string }) => e ? <p className="rounded-xl bg-red-50 text-red-700 text-sm px-4 py-2.5 mb-4">{e}</p> : null;
const DevCode = ({ code }: { code?: string }) => code ? <p className="rounded-xl bg-amber-50 text-amber-800 text-sm px-4 py-2.5 mb-4">Dev mode (no email service configured): your code is <b>{code}</b></p> : null;

export function Login() {
  const [f, setF] = useState({ email: '', password: '' });
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const { setUser, toast } = useApp(); const nav = useNavigate(); const loc = useLocation();
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr('');
    try {
      const d = await api.post('/api/auth/login', f);
      setUser(d.user); toast(`Welcome back, ${d.user.fullName.split(' ')[0]}!`);
      nav(d.user.role === 'admin' ? '/admin' : !d.user.emailVerified ? '/verify-email' : (loc.state?.from || '/'));
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  return <Shell title="Welcome back" sub="Log in with your institutional email.">
    <Err e={err} />
    <form onSubmit={submit} className="space-y-4">
      <div><label className="label">Institutional Email</label><input className="input" type="email" required value={f.email} onChange={e => setF({ ...f, email: e.target.value })} /></div>
      <div><label className="label">Password</label><input className="input" type="password" required value={f.password} onChange={e => setF({ ...f, password: e.target.value })} /></div>
      <button className="btn-primary w-full" disabled={busy}>{busy ? 'Logging in…' : 'Login'}</button>
    </form>
    <div className="flex justify-between mt-4 text-sm">
      <Link to="/forgot-password" className="text-brand-600 font-medium">Forgot password?</Link>
      <Link to="/signup" className="text-brand-600 font-medium">Create account</Link>
    </div>
  </Shell>;
}

export function Signup() {
  const [f, setF] = useState({ fullName: '', email: '', password: '', confirmPassword: '', batch: '', phone: '' });
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const { setUser } = useApp(); const nav = useNavigate();
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr('');
    try {
      const d = await api.post('/api/auth/signup', f);
      setUser(d.user);
      nav('/verify-email', { state: { devCode: d.devCode } });
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  return <Shell title="Join SoMart" sub="Only approved institutional email addresses can register.">
    <Err e={err} />
    <form onSubmit={submit} className="space-y-4">
      <div><label className="label">Full Name *</label><input className="input" required value={f.fullName} onChange={e => setF({ ...f, fullName: e.target.value })} /></div>
      <div><label className="label">Institutional Email *</label><input className="input" type="email" required placeholder="you@bitsom.edu.in" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label">Password *</label><input className="input" type="password" required minLength={8} value={f.password} onChange={e => setF({ ...f, password: e.target.value })} /></div>
        <div><label className="label">Confirm *</label><input className="input" type="password" required value={f.confirmPassword} onChange={e => setF({ ...f, confirmPassword: e.target.value })} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label">Batch / Grad Year</label><input className="input" placeholder="2027" value={f.batch} onChange={e => setF({ ...f, batch: e.target.value })} /></div>
        <div><label className="label">Phone (optional)</label><input className="input" value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} /></div>
      </div>
      <button className="btn-primary w-full" disabled={busy}>{busy ? 'Creating account…' : 'Sign up'}</button>
    </form>
    <p className="text-sm mt-4 text-center">Already registered? <Link to="/login" className="text-brand-600 font-medium">Login</Link></p>
  </Shell>;
}

export function VerifyEmail() {
  const loc = useLocation();
  const [code, setCode] = useState(''); const [err, setErr] = useState('');
  const [devCode, setDevCode] = useState<string | undefined>(loc.state?.devCode);
  const { refresh, toast, user } = useApp(); const nav = useNavigate();
  if (user?.emailVerified) return <Shell title="Email verified ✓"><Link to="/" className="btn-primary w-full">Go to homepage</Link></Shell>;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr('');
    try { await api.post('/api/auth/verify-email', { code }); await refresh(); toast('Email verified! Welcome to SoMart.'); nav('/'); }
    catch (e: any) { setErr(e.message); }
  };
  const resend = async () => {
    try { const d = await api.post('/api/auth/resend-verification'); setDevCode(d.devCode); toast('New code sent to your email.'); }
    catch (e: any) { setErr(e.message); }
  };
  return <Shell title="Verify your email" sub={`We sent a 6-digit code to ${user?.email || 'your email'}. Until verified, you cannot create listings or send requests.`}>
    <Err e={err} /><DevCode code={devCode} />
    <form onSubmit={submit} className="space-y-4">
      <input className="input text-center text-2xl tracking-[0.5em] font-bold" maxLength={6} required value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} placeholder="••••••" />
      <button className="btn-primary w-full">Verify</button>
    </form>
    <button onClick={resend} className="btn-secondary w-full mt-3">Resend code</button>
  </Shell>;
}

export function ForgotPassword() {
  const [email, setEmail] = useState(''); const [sent, setSent] = useState(false); const [devCode, setDevCode] = useState<string>();
  const nav = useNavigate();
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const d = await api.post('/api/auth/forgot-password', { email });
    setDevCode(d.devCode); setSent(true);
  };
  return <Shell title="Forgot password" sub="Enter your institutional email and we'll send a reset code.">
    <DevCode code={devCode} />
    {sent ? <div className="space-y-3">
      <p className="text-sm text-emerald-700 bg-emerald-50 rounded-xl px-4 py-2.5">If the account exists, a reset code has been sent.</p>
      <button className="btn-primary w-full" onClick={() => nav('/reset-password', { state: { email, devCode } })}>Enter reset code</button>
    </div> : <form onSubmit={submit} className="space-y-4">
      <input className="input" type="email" required placeholder="you@bitsom.edu.in" value={email} onChange={e => setEmail(e.target.value)} />
      <button className="btn-primary w-full">Send reset code</button>
    </form>}
  </Shell>;
}

export function ResetPassword() {
  const loc = useLocation();
  const [f, setF] = useState({ email: loc.state?.email || '', code: '', password: '' });
  const [err, setErr] = useState(''); const { toast } = useApp(); const nav = useNavigate();
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr('');
    try { await api.post('/api/auth/reset-password', f); toast('Password reset. Please log in.'); nav('/login'); }
    catch (e: any) { setErr(e.message); }
  };
  return <Shell title="Reset password">
    <Err e={err} /><DevCode code={loc.state?.devCode} />
    <form onSubmit={submit} className="space-y-4">
      <div><label className="label">Email</label><input className="input" type="email" required value={f.email} onChange={e => setF({ ...f, email: e.target.value })} /></div>
      <div><label className="label">Reset code</label><input className="input" required value={f.code} onChange={e => setF({ ...f, code: e.target.value })} /></div>
      <div><label className="label">New password</label><input className="input" type="password" required minLength={8} value={f.password} onChange={e => setF({ ...f, password: e.target.value })} /></div>
      <button className="btn-primary w-full">Reset password</button>
    </form>
  </Shell>;
}

export function AdminLogin() {
  const [f, setF] = useState({ username: '', password: '' });
  const [err, setErr] = useState(''); const { setUser } = useApp(); const nav = useNavigate();
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr('');
    try { const d = await api.post('/api/auth/admin/login', f); setUser(d.user); nav('/admin'); }
    catch (e: any) { setErr(e.message); }
  };
  return <Shell title="Admin Login" sub="Restricted access — platform administrators only.">
    <Err e={err} />
    <form onSubmit={submit} className="space-y-4">
      <div><label className="label">Admin Username</label><input className="input" required value={f.username} onChange={e => setF({ ...f, username: e.target.value })} /></div>
      <div><label className="label">Password</label><input className="input" type="password" required value={f.password} onChange={e => setF({ ...f, password: e.target.value })} /></div>
      <button className="btn-primary w-full">Login</button>
    </form>
  </Shell>;
}
