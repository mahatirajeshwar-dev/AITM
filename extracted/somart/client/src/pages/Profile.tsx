import React, { useEffect, useState } from 'react';
import { api, timeAgo } from '../lib/api';
import { useApp } from '../lib/store';
import { Spinner, Stars } from '../components/ui';

export default function Profile() {
  const { user, refresh, toast } = useApp();
  const [data, setData] = useState<any>(null);
  const [f, setF] = useState<any>(null);
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });
  useEffect(() => { api.get('/api/profile').then(d => { setData(d); setF({ fullName: d.user.fullName, batch: d.user.batch || '', phone: d.user.phone || '', contactPref: d.user.contactPref, profileImage: d.user.profileImage || '' }); }); }, []);
  if (!data || !f) return <Spinner />;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await api.put('/api/profile', f); await refresh(); toast('Profile updated.'); } catch (e: any) { toast(e.message, 'error'); }
  };
  const changePw = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await api.put('/api/profile/password', pw); setPw({ currentPassword: '', newPassword: '' }); toast('Password changed.'); } catch (e: any) { toast(e.message, 'error'); }
  };

  return (
    <div className="max-w-3xl mx-auto grid md:grid-cols-[1fr_320px] gap-6">
      <div className="space-y-6">
        <form onSubmit={save} className="card p-6 space-y-4">
          <h1 className="text-xl font-bold">My Profile</h1>
          <div><label className="label">Full Name</label><input className="input" value={f.fullName} onChange={e => setF({ ...f, fullName: e.target.value })} /></div>
          <div><label className="label">Institutional Email</label>
            <input className="input bg-slate-50" value={user.email} disabled />
            <p className="text-[11px] text-slate-400 mt-1">Email cannot be changed directly — changing it requires re-verification via admin.</p></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Batch</label><input className="input" value={f.batch} onChange={e => setF({ ...f, batch: e.target.value })} /></div>
            <div><label className="label">Phone</label><input className="input" value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} /></div>
          </div>
          <div><label className="label">Contact Preference</label>
            <select className="input" value={f.contactPref} onChange={e => setF({ ...f, contactPref: e.target.value })}>
              <option value="chat">In-app chat only</option><option value="phone">Willing to share phone in chat</option>
            </select></div>
          <div><label className="label">Profile Picture URL</label><input className="input" placeholder="https://…" value={f.profileImage} onChange={e => setF({ ...f, profileImage: e.target.value })} /></div>
          <button className="btn-primary">Save changes</button>
        </form>
        <form onSubmit={changePw} className="card p-6 space-y-4">
          <h2 className="font-bold">Change Password</h2>
          <div><label className="label">Current password</label><input className="input" type="password" required value={pw.currentPassword} onChange={e => setPw({ ...pw, currentPassword: e.target.value })} /></div>
          <div><label className="label">New password</label><input className="input" type="password" required minLength={8} value={pw.newPassword} onChange={e => setPw({ ...pw, newPassword: e.target.value })} /></div>
          <button className="btn-secondary">Update password</button>
        </form>
      </div>
      <div className="card p-6 h-fit">
        <div className="text-center">
          <span className="h-20 w-20 rounded-full bg-brand-100 text-brand-700 grid place-items-center font-extrabold text-3xl mx-auto">{user.fullName[0]}</span>
          <h2 className="font-bold mt-2">{user.fullName}</h2>
          <p className="text-xs text-slate-500">Batch of {user.batch || '—'}</p>
          <div className="mt-2"><Stars value={data.avgRating} /></div>
          <p className="text-sm text-slate-600">{data.avgRating ? `${data.avgRating} average` : 'No ratings yet'} · {data.completedTransactions} completed deals</p>
        </div>
        <h3 className="font-bold text-sm mt-5 mb-2">Reviews ({data.reviews.length})</h3>
        <div className="space-y-3 max-h-80 overflow-y-auto">
          {data.reviews.length === 0 && <p className="text-xs text-slate-400">Complete transactions to receive reviews.</p>}
          {data.reviews.map((r: any) => (
            <div key={r.id} className="rounded-xl bg-slate-50 p-3">
              <div className="flex items-center justify-between"><Stars value={r.rating} size="text-sm" /><span className="text-[10px] text-slate-400">{timeAgo(r.createdAt)}</span></div>
              {r.comment && <p className="text-xs text-slate-600 mt-1">{r.comment}</p>}
              <p className="text-[10px] text-slate-400 mt-0.5">— {r.reviewer.firstName}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
