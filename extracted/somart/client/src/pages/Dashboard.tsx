import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, money, fmtDate, statusLabel } from '../lib/api';
import { useApp } from '../lib/store';
import { Spinner, Empty, StatusBadge, Confirm, img } from '../components/ui';

const TABS = ['My Listings', 'Buying Activity', 'Rental Activity', 'Transactions'];

export default function Dashboard() {
  const { user, toast } = useApp();
  const nav = useNavigate();
  const [tab, setTab] = useState(0);
  const [listings, setListings] = useState<any[] | null>(null);
  const [txs, setTxs] = useState<any[] | null>(null);
  const [del, setDel] = useState<string | null>(null);

  const load = () => {
    api.get(`/api/listings?sellerId=${user.id}&includeMine=1`).then(d => setListings(d.listings));
    api.get('/api/transactions').then(d => setTxs(d.transactions));
  };
  useEffect(load, []);
  if (!listings || !txs) return <Spinner />;

  const asBuyer = txs.filter(t => t.myRole === 'buyer');
  const asSeller = txs.filter(t => t.myRole === 'seller');
  const rentals = txs.filter(t => t.transactionType === 'rental');
  const needsAction = txs.filter(t =>
    (t.myRole === 'seller' && t.status === 'request_sent') ||
    (t.status === 'deal_in_progress' && !(t.myRole === 'buyer' ? t.buyerAmountConfirmed : t.sellerAmountConfirmed)) ||
    ['awaiting_handover', 'awaiting_return'].includes(t.status));

  const remove = async () => {
    try { await api.del(`/api/listings/${del}`); toast('Listing deleted.'); load(); } catch (e: any) { toast(e.message, 'error'); }
    setDel(null);
  };

  const TxRow = ({ t }: { t: any }) => (
    <Link to={`/transactions/${t.id}`} className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 border border-slate-100">
      <img src={img(t.listing)} className="h-12 w-14 rounded-lg object-cover" />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm truncate">{t.listing?.title}</p>
        <p className="text-xs text-slate-500">{t.myRole === 'buyer' ? `From ${t.seller?.firstName}` : `With ${t.buyer?.firstName}`} · {t.transactionType} · {fmtDate(t.createdAt)}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-bold">{money(t.agreedAmount ?? t.listedAmount)}</p>
        <StatusBadge status={t.status} />
      </div>
    </Link>
  );

  const groupTx = (list: any[], groups: [string, (t: any) => boolean][]) => groups.map(([title, fn]) => {
    const items = list.filter(fn);
    if (!items.length) return null;
    return <div key={title}><h3 className="font-semibold text-sm text-slate-500 mt-4 mb-2">{title} ({items.length})</h3><div className="space-y-2">{items.map(t => <TxRow key={t.id} t={t} />)}</div></div>;
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h1 className="text-2xl font-bold">My Dashboard</h1>
        <Link to="/create" className="btn-primary">+ New Listing</Link>
      </div>

      {needsAction.length > 0 && (
        <div className="card p-4 mb-4 border-amber-200 bg-amber-50/50">
          <h2 className="font-bold text-amber-800 mb-2">⚡ Needs your attention ({needsAction.length})</h2>
          <div className="space-y-2">{needsAction.slice(0, 5).map(t => <TxRow key={t.id} t={t} />)}</div>
        </div>
      )}

      <div className="flex gap-1 border-b border-slate-200 mb-4 overflow-x-auto">
        {TABS.map((t, i) => (
          <button key={t} onClick={() => setTab(i)} className={`px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 -mb-px ${tab === i ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>{t}</button>
        ))}
      </div>

      {tab === 0 && (listings.length === 0 ? <Empty title="No listings yet" sub="Sell or rent out something you no longer need." action={<Link to="/create" className="btn-primary">Create listing</Link>} /> : (
        <div className="space-y-2">
          {['active','deal_in_progress','sold','rented','paused','inactive','removed'].map(st => {
            const items = listings.filter(l => l.status === st);
            if (!items.length) return null;
            return <div key={st}>
              <h3 className="font-semibold text-sm text-slate-500 mt-4 mb-2">{statusLabel[st]} ({items.length})</h3>
              {items.map(l => (
                <div key={l.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:bg-slate-50 mb-2">
                  <img src={img(l)} className="h-12 w-14 rounded-lg object-cover" />
                  <Link to={`/listing/${l.id}`} className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{l.title}</p>
                    <p className="text-xs text-slate-500">{l.listingType === 'rent' ? `${money(l.rentalRate)}/${l.rentalUnit}` : money(l.price)} · {fmtDate(l.createdAt)}</p>
                  </Link>
                  <StatusBadge status={l.status} />
                  {['active','paused','inactive'].includes(l.status) && <>
                    <button className="btn-secondary !px-3 !py-1.5" onClick={() => nav(`/edit/${l.id}`)}>Edit</button>
                    <button className="btn-danger !px-3 !py-1.5" onClick={() => setDel(l.id)}>Delete</button>
                  </>}
                </div>
              ))}
            </div>;
          })}
        </div>
      ))}

      {tab === 1 && (asBuyer.filter(t => t.transactionType === 'sale').length === 0 ? <Empty title="No buying activity" sub="Browse the marketplace to find something you need." /> :
        groupTx(asBuyer.filter(t => t.transactionType === 'sale'), [
          ['Requests Sent', t => t.status === 'request_sent'],
          ['Accepted / In Progress', t => ['deal_in_progress','awaiting_handover'].includes(t.status)],
          ['Completed Purchases', t => t.status === 'completed'],
          ['Rejected / Cancelled', t => ['rejected','cancelled'].includes(t.status)],
        ]))}

      {tab === 2 && (rentals.length === 0 ? <Empty title="No rental activity" sub="Rent items instead of buying — or rent out your own." /> :
        groupTx(rentals, [
          ['Items I Am Renting', t => t.myRole === 'buyer' && ['rented','awaiting_return'].includes(t.status)],
          ['Items I Have Rented Out', t => t.myRole === 'seller' && ['rented','awaiting_return'].includes(t.status)],
          ['Requests & Deals', t => ['request_sent','deal_in_progress','awaiting_handover'].includes(t.status)],
          ['Upcoming Returns', t => t.status === 'awaiting_return'],
          ['Completed Rentals', t => t.status === 'completed'],
          ['Rejected / Cancelled', t => ['rejected','cancelled'].includes(t.status)],
        ]))}

      {tab === 3 && (txs.length === 0 ? <Empty title="No transactions yet" /> : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-slate-500 border-b border-slate-200">
              {['ID','Item','Buyer','Seller','Type','Listed','Agreed','Date','Status'].map(h => <th key={h} className="px-3 py-2.5 font-semibold">{h}</th>)}
            </tr></thead>
            <tbody>
              {txs.map(t => (
                <tr key={t.id} className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer" onClick={() => nav(`/transactions/${t.id}`)}>
                  <td className="px-3 py-2.5 font-mono text-xs">{t.id.slice(-6)}</td>
                  <td className="px-3 py-2.5 font-medium max-w-[160px] truncate">{t.listing?.title}</td>
                  <td className="px-3 py-2.5">{t.buyer?.firstName}</td>
                  <td className="px-3 py-2.5">{t.seller?.firstName}</td>
                  <td className="px-3 py-2.5 capitalize">{t.transactionType}</td>
                  <td className="px-3 py-2.5">{money(t.listedAmount)}</td>
                  <td className="px-3 py-2.5 font-semibold">{money(t.agreedAmount) || '—'}</td>
                  <td className="px-3 py-2.5">{fmtDate(t.createdAt)}</td>
                  <td className="px-3 py-2.5"><StatusBadge status={t.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      <Confirm open={!!del} onClose={() => setDel(null)} onConfirm={remove} danger title="Delete this listing?" body="The listing will be removed from the marketplace. Transaction history is preserved." confirmLabel="Delete" />
    </div>
  );
}
