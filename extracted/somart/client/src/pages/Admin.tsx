import React, { useEffect, useState } from 'react';
import { api, money, fmtDate, timeAgo } from '../lib/api';
import { useApp } from '../lib/store';
import { Spinner, StatusBadge, Confirm } from '../components/ui';

const TABS = ['Analytics', 'Users', 'Listings', 'Transactions', 'Reports', 'Audit Log'];

function Stat({ label, value, sub }: any) {
  return <div className="card p-4"><p className="text-xs text-slate-500">{label}</p><p className="text-2xl font-extrabold mt-0.5">{value}</p>{sub && <p className="text-[10px] text-slate-400">{sub}</p>}</div>;
}
function Bars({ title, data, xKey, yKey, fmt }: any) {
  const max = Math.max(...data.map((d: any) => d[yKey]), 1);
  return (
    <div className="card p-5">
      <h3 className="font-bold text-sm mb-3">{title}</h3>
      {data.length === 0 ? <p className="text-xs text-slate-400">No data yet.</p> : (
        <div className="space-y-2">
          {data.map((d: any) => (
            <div key={d[xKey]} className="flex items-center gap-2 text-xs">
              <span className="w-24 truncate text-slate-500">{d[xKey]}</span>
              <div className="flex-1 h-5 bg-slate-100 rounded-md overflow-hidden">
                <div className="h-full bg-brand-500 rounded-md" style={{ width: `${(d[yKey] / max) * 100}%` }} />
              </div>
              <span className="w-20 text-right font-semibold">{fmt ? fmt(d[yKey]) : d[yKey]}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Admin() {
  const { toast } = useApp();
  const [tab, setTab] = useState(0);
  const [an, setAn] = useState<any>(null);
  const [users, setUsers] = useState<any>(null);
  const [listings, setListings] = useState<any>(null);
  const [txs, setTxs] = useState<any[] | null>(null);
  const [reports, setReports] = useState<any[] | null>(null);
  const [logs, setLogs] = useState<any[] | null>(null);
  const [override, setOverride] = useState<any>(null);
  const [reason, setReason] = useState('');

  const load = () => {
    api.get('/api/admin/analytics').then(setAn);
    api.get('/api/admin/users').then(setUsers);
    api.get('/api/admin/listings').then(setListings);
    api.get('/api/admin/transactions').then(d => setTxs(d.transactions));
    api.get('/api/admin/reports').then(d => setReports(d.reports));
    api.get('/api/admin/audit-logs').then(d => setLogs(d.logs));
  };
  useEffect(load, []);
  const act = async (fn: () => Promise<any>, msg: string) => { try { await fn(); toast(msg); load(); } catch (e: any) { toast(e.message, 'error'); } };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Admin Dashboard</h1>
      <div className="flex gap-1 border-b border-slate-200 mb-4 overflow-x-auto">
        {TABS.map((t, i) => <button key={t} onClick={() => setTab(i)} className={`px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 -mb-px ${tab === i ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500'}`}>{t}</button>)}
      </div>

      {tab === 0 && (!an ? <Spinner /> : <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Registered users" value={an.totals.totalUsers} />
          <Stat label="Verified users" value={an.totals.verifiedUsers} />
          <Stat label="Active listings" value={an.totals.activeListings} sub={`${an.totals.totalListings} total`} />
          <Stat label="Items sold" value={an.totals.itemsSold} />
          <Stat label="Active rentals" value={an.totals.activeRentals} sub={`${an.totals.completedRentals} completed`} />
          <Stat label="Total transactions" value={an.totals.totalTransactions} />
          <Stat label="Recorded value" value={money(an.totals.totalRecordedValue)} sub="NOT platform revenue" />
          <Stat label="Avg agreed / listing price" value={`${money(an.totals.avgAgreedPrice)} / ${money(an.totals.avgListingPrice)}`} />
        </div>
        <p className="text-[11px] text-slate-400">{an.totals.note}</p>
        <div className="grid md:grid-cols-2 gap-4">
          <Bars title="Transactions by month" data={an.byMonth} xKey="month" yKey="count" />
          <Bars title="Transaction value by month" data={an.byMonth} xKey="month" yKey="value" fmt={money} />
          <Bars title="Listings by category" data={an.byCategory} xKey="category" yKey="count" />
          <Bars title="Sale vs Rental" data={an.saleVsRental} xKey="type" yKey="count" />
          <Bars title="Most active users" data={an.mostActiveUsers.map((u: any) => ({ name: u.user?.fullName, transactions: u.transactions }))} xKey="name" yKey="transactions" />
        </div>
      </div>)}

      {tab === 1 && (!users ? <Spinner /> : <div className="space-y-4">
        <div className="grid grid-cols-4 gap-3">
          <Stat label="Total" value={users.counts.total} /><Stat label="Verified" value={users.counts.verified} />
          <Stat label="Suspended" value={users.counts.suspended} /><Stat label="Blocked" value={users.counts.blocked} />
        </div>
        <div className="card overflow-x-auto"><table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-slate-500 border-b">{['Name','Email','Batch','Verified','Status','Actions'].map(h => <th key={h} className="px-3 py-2.5">{h}</th>)}</tr></thead>
          <tbody>{users.users.map((u: any) => (
            <tr key={u.id} className="border-b border-slate-100">
              <td className="px-3 py-2.5 font-medium">{u.fullName}</td>
              <td className="px-3 py-2.5 text-slate-500">{u.email}</td>
              <td className="px-3 py-2.5">{u.batch || '—'}</td>
              <td className="px-3 py-2.5">{u.emailVerified ? '✅' : '—'}</td>
              <td className="px-3 py-2.5"><StatusBadge status={u.accountStatus === 'active' ? 'active' : u.accountStatus === 'suspended' ? 'paused' : 'removed'} /></td>
              <td className="px-3 py-2.5 space-x-1 whitespace-nowrap">
                {u.accountStatus !== 'suspended' && <button className="btn-secondary !px-2.5 !py-1 !text-xs" onClick={() => act(() => api.post(`/api/admin/users/${u.id}/status`, { status: 'suspended', reason: 'Admin action' }), 'User suspended')}>Suspend</button>}
                {u.accountStatus !== 'blocked' ? <button className="btn-danger !px-2.5 !py-1 !text-xs" onClick={() => act(() => api.post(`/api/admin/users/${u.id}/status`, { status: 'blocked', reason: 'Admin action' }), 'User blocked')}>Block</button>
                  : <button className="btn-secondary !px-2.5 !py-1 !text-xs" onClick={() => act(() => api.post(`/api/admin/users/${u.id}/status`, { status: 'active', reason: 'Unblocked' }), 'User unblocked')}>Unblock</button>}
                {u.accountStatus === 'suspended' && <button className="btn-secondary !px-2.5 !py-1 !text-xs" onClick={() => act(() => api.post(`/api/admin/users/${u.id}/status`, { status: 'active', reason: 'Restored' }), 'User restored')}>Restore</button>}
              </td>
            </tr>))}</tbody></table></div>
      </div>)}

      {tab === 2 && (!listings ? <Spinner /> : <div className="space-y-4">
        <div className="grid grid-cols-5 gap-3">
          <Stat label="Active" value={listings.counts.active} /><Stat label="Sold" value={listings.counts.sold} />
          <Stat label="Rentals" value={listings.counts.rental} /><Stat label="Removed" value={listings.counts.removed} /><Stat label="Reported" value={listings.counts.reported} />
        </div>
        <div className="card overflow-x-auto"><table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-slate-500 border-b">{['Title','Seller','Type','Price','Status','Reports','Actions'].map(h => <th key={h} className="px-3 py-2.5">{h}</th>)}</tr></thead>
          <tbody>{listings.listings.map((l: any) => (
            <tr key={l.id} className="border-b border-slate-100">
              <td className="px-3 py-2.5 font-medium max-w-[180px] truncate"><a href={`/listing/${l.id}`} target="_blank" className="hover:text-brand-600">{l.title}</a></td>
              <td className="px-3 py-2.5">{l.seller?.firstName}</td>
              <td className="px-3 py-2.5 capitalize">{l.listingType}</td>
              <td className="px-3 py-2.5">{money(l.price ?? l.rentalRate)}</td>
              <td className="px-3 py-2.5"><StatusBadge status={l.status} /></td>
              <td className="px-3 py-2.5">{l.reportCount || '—'}</td>
              <td className="px-3 py-2.5 space-x-1 whitespace-nowrap">
                {l.status !== 'removed' ? <button className="btn-danger !px-2.5 !py-1 !text-xs" onClick={() => act(() => api.post(`/api/admin/listings/${l.id}/status`, { status: 'removed', reason: 'Admin removal' }), 'Listing removed')}>Remove</button>
                  : <button className="btn-secondary !px-2.5 !py-1 !text-xs" onClick={() => act(() => api.post(`/api/admin/listings/${l.id}/status`, { status: 'active', reason: 'Restored' }), 'Listing restored')}>Restore</button>}
                {l.status === 'active' && <button className="btn-secondary !px-2.5 !py-1 !text-xs" onClick={() => act(() => api.post(`/api/admin/listings/${l.id}/status`, { status: 'paused', reason: 'Suspended' }), 'Listing suspended')}>Suspend</button>}
              </td>
            </tr>))}</tbody></table></div>
      </div>)}

      {tab === 3 && (!txs ? <Spinner /> : <div className="card overflow-x-auto"><table className="w-full text-sm">
        <thead><tr className="text-left text-xs text-slate-500 border-b">{['ID','Item','Buyer','Seller','Type','Listed','Agreed','Date','Status','OTP','Override'].map(h => <th key={h} className="px-3 py-2.5">{h}</th>)}</tr></thead>
        <tbody>{txs.map(t => (
          <tr key={t.id} className="border-b border-slate-100">
            <td className="px-3 py-2.5 font-mono text-xs">{t.id.slice(-6)}</td>
            <td className="px-3 py-2.5 max-w-[140px] truncate">{t.item}</td>
            <td className="px-3 py-2.5">{t.buyer?.firstName}</td>
            <td className="px-3 py-2.5">{t.seller?.firstName}</td>
            <td className="px-3 py-2.5 capitalize">{t.transactionType}</td>
            <td className="px-3 py-2.5">{money(t.listedAmount)}</td>
            <td className="px-3 py-2.5 font-semibold">{money(t.agreedAmount) || '—'}</td>
            <td className="px-3 py-2.5">{fmtDate(t.createdAt)}</td>
            <td className="px-3 py-2.5"><StatusBadge status={t.status} /></td>
            <td className="px-3 py-2.5 text-xs">{t.otpStatus ? `${t.otpStatus.phase}: B${t.otpStatus.buyerVerified ? '✓' : '○'} S${t.otpStatus.sellerVerified ? '✓' : '○'}` : '—'}</td>
            <td className="px-3 py-2.5">{!['completed','cancelled','rejected'].includes(t.status) && <button className="btn-secondary !px-2.5 !py-1 !text-xs" onClick={() => setOverride(t)}>Cancel…</button>}</td>
          </tr>))}</tbody></table>
        <p className="text-[11px] text-slate-400 p-3">Admins cannot mark transactions completed — completion requires dual OTP verification by both parties. Cancel override requires a reason and is audit-logged.</p>
      </div>)}

      {tab === 4 && (!reports ? <Spinner /> : <div className="space-y-3">
        {reports.length === 0 && <div className="card p-8 text-center text-slate-500">No reports.</div>}
        {reports.map(rp => (
          <div key={rp.id} className="card p-4 flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[200px]">
              <p className="font-semibold text-sm capitalize">{rp.reason.replace(/_/g, ' ')} <StatusBadge status={rp.status === 'open' ? 'request_sent' : rp.status === 'actioned' ? 'completed' : 'inactive'} /></p>
              <p className="text-xs text-slate-500">By {rp.reporter?.firstName} · {timeAgo(rp.createdAt)} {rp.listing && <>· Listing: <a href={`/listing/${rp.listing.id}`} target="_blank" className="text-brand-600">{rp.listing.title}</a></>} {rp.reportedUser && <>· User: {rp.reportedUser.fullName}</>}</p>
              {rp.details && <p className="text-xs text-slate-600 mt-1">{rp.details}</p>}
            </div>
            {rp.status === 'open' && <>
              <button className="btn-secondary !px-3 !py-1.5 !text-xs" onClick={() => act(() => api.post(`/api/admin/reports/${rp.id}/status`, { status: 'dismissed' }), 'Report dismissed')}>Dismiss</button>
              <button className="btn-primary !px-3 !py-1.5 !text-xs" onClick={() => act(() => api.post(`/api/admin/reports/${rp.id}/status`, { status: 'actioned' }), 'Report actioned')}>Mark actioned</button>
            </>}
          </div>))}
      </div>)}

      {tab === 5 && (!logs ? <Spinner /> : <div className="card overflow-x-auto"><table className="w-full text-sm">
        <thead><tr className="text-left text-xs text-slate-500 border-b">{['Time','Action','Target','Reason'].map(h => <th key={h} className="px-3 py-2.5">{h}</th>)}</tr></thead>
        <tbody>{logs.map(l => (
          <tr key={l.id} className="border-b border-slate-100">
            <td className="px-3 py-2.5 text-xs text-slate-500">{new Date(l.createdAt).toLocaleString('en-IN')}</td>
            <td className="px-3 py-2.5 font-medium">{l.action}</td>
            <td className="px-3 py-2.5 text-xs">{l.targetType} {l.targetId?.slice(-6)}</td>
            <td className="px-3 py-2.5 text-xs text-slate-500">{l.reason || '—'}</td>
          </tr>))}</tbody></table>
        {logs.length === 0 && <p className="p-6 text-center text-sm text-slate-400">No admin actions logged yet.</p>}
      </div>)}

      <Confirm open={!!override} onClose={() => { setOverride(null); setReason(''); }} danger title="Admin override — cancel transaction" confirmLabel="Confirm override"
        body={`This cancels transaction ${override?.id?.slice(-6)} and reactivates the listing. A reason is required and this action is audit-logged.`}
        onConfirm={() => { if (!reason.trim()) { toast('Reason required', 'error'); return; } act(() => api.post(`/api/admin/transactions/${override.id}/override`, { action: 'cancel', reason, confirm: true }), 'Transaction cancelled (override)'); setOverride(null); setReason(''); }}>
        <input className="input mt-3" placeholder="Reason for override (required)" value={reason} onChange={e => setReason(e.target.value)} />
      </Confirm>
    </div>
  );
}
