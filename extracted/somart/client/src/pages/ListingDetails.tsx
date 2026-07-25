import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, money, condLabel, fmtDate, rentalUnitLabel } from '../lib/api';
import { useApp } from '../lib/store';
import { Spinner, Stars, StatusBadge, Confirm, img } from '../components/ui';

export default function ListingDetails() {
  const { id } = useParams();
  const [l, setL] = useState<any>(null);
  const [err, setErr] = useState('');
  const [imgIdx, setImgIdx] = useState(0);
  const [confirm, setConfirm] = useState(false);
  const [report, setReport] = useState(false);
  const [reportForm, setReportForm] = useState({ reason: 'fake_listing', details: '' });
  const { user, toast } = useApp();
  const nav = useNavigate();
  const isRent = l?.listingType === 'rent';

  useEffect(() => { api.get(`/api/listings/${id}`).then(d => setL(d.listing)).catch(e => setErr(e.message)); }, [id]);
  if (err) return <div className="card p-12 text-center"><h2 className="text-xl font-bold">{err}</h2></div>;
  if (!l) return <Spinner />;

  const guard = () => {
    if (!user) { nav('/login', { state: { from: `/listing/${id}` } }); return false; }
    if (!user.emailVerified) { toast('Please verify your email first.', 'error'); nav('/verify-email'); return false; }
    return true;
  };
  const interested = async () => {
    try {
      const d = await api.post('/api/transactions', { listingId: l.id });
      toast(isRent ? 'Rental request sent to the owner!' : 'Interest sent to the seller!');
      nav(`/transactions/${d.transaction.id}`);
    } catch (e: any) { toast(e.message, 'error'); }
    setConfirm(false);
  };
  const contact = async () => {
    if (!guard()) return;
    try { const d = await api.post('/api/messages/start', { userId: l.seller.id, listingId: l.id }); nav(`/messages/${d.conversationId}`); }
    catch (e: any) { toast(e.message, 'error'); }
  };
  const sendReport = async () => {
    try { await api.post('/api/reports', { ...reportForm, listingId: l.id }); toast('Report submitted. Our admins will review it.'); setReport(false); }
    catch (e: any) { toast(e.message, 'error'); }
  };

  const images = l.images?.length ? l.images : [{ url: img(l) }];
  return (
    <div className="grid lg:grid-cols-[1fr_380px] gap-6">
      <div className="card overflow-hidden">
        <div className="aspect-[4/3] bg-slate-100"><img src={images[imgIdx]?.url} alt={l.title} className="w-full h-full object-cover" /></div>
        {images.length > 1 && (
          <div className="flex gap-2 p-3 overflow-x-auto">
            {images.map((im: any, i: number) => (
              <button key={i} onClick={() => setImgIdx(i)} className={`h-16 w-20 rounded-lg overflow-hidden border-2 shrink-0 ${i === imgIdx ? 'border-brand-600' : 'border-transparent'}`}>
                <img src={im.url} className="w-full h-full object-cover" /></button>
            ))}
          </div>
        )}
        <div className="p-5 border-t border-slate-100">
          <h2 className="font-bold text-lg mb-2">Description</h2>
          <p className="text-slate-700 whitespace-pre-wrap text-sm leading-relaxed">{l.description}</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="card p-5">
          <div className="flex items-start justify-between gap-2">
            <h1 className="text-2xl font-extrabold leading-tight">{l.title}</h1>
            <span className={`badge ${isRent ? 'bg-indigo-600' : 'bg-emerald-600'} text-white shrink-0`}>{isRent ? 'For Rent' : 'For Sale'}</span>
          </div>
          <p className="text-3xl font-extrabold text-brand-700 mt-3">
            {isRent ? <>{money(l.rentalRate)}<span className="text-base text-slate-500 font-semibold">{rentalUnitLabel[l.rentalUnit]}</span></> : money(l.price)}
          </p>
          {l.negotiable && <span className="badge bg-amber-100 text-amber-800 mt-1">Negotiable</span>}
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-slate-500">Category</dt><dd className="font-medium">{l.category}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Condition</dt><dd className="font-medium">{condLabel[l.condition]}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Pickup location</dt><dd className="font-medium">{l.location}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Posted</dt><dd className="font-medium">{fmtDate(l.createdAt)}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Availability</dt><dd><StatusBadge status={l.status} /></dd></div>
            {isRent && l.securityDeposit != null && <div className="flex justify-between"><dt className="text-slate-500">Security deposit</dt><dd className="font-medium">{money(l.securityDeposit)}</dd></div>}
            {isRent && l.minRentalPeriod && <div className="flex justify-between"><dt className="text-slate-500">Rental period</dt><dd className="font-medium">{l.minRentalPeriod}–{l.maxRentalPeriod || '∞'} {l.rentalUnit}s</dd></div>}
            {isRent && l.availableFrom && <div className="flex justify-between"><dt className="text-slate-500">Available</dt><dd className="font-medium">{fmtDate(l.availableFrom)} – {fmtDate(l.availableUntil)}</dd></div>}
          </dl>
          {l.isOwner ? (
            <div className="mt-5 flex gap-2">
              <Link to={`/edit/${l.id}`} className="btn-secondary flex-1">Edit listing</Link>
              <Link to="/dashboard" className="btn-primary flex-1">My Dashboard</Link>
            </div>
          ) : l.status === 'active' ? (
            <div className="mt-5 space-y-2">
              <button className="btn-primary w-full !py-3" onClick={() => guard() && setConfirm(true)}>{isRent ? 'Request to Rent' : "I'm Interested"}</button>
              <button className="btn-secondary w-full" onClick={contact}>{isRent ? 'Contact Owner' : 'Contact Seller'}</button>
            </div>
          ) : <p className="mt-5 text-sm text-slate-500 bg-slate-50 rounded-xl p-3 text-center">This item is currently not available.</p>}
        </div>

        <div className="card p-5">
          <h2 className="font-bold mb-3">{isRent ? 'Owner' : 'Seller'}</h2>
          <div className="flex items-center gap-3">
            <span className="h-12 w-12 rounded-full bg-brand-100 text-brand-700 grid place-items-center font-bold text-lg">{l.seller.fullName[0]}</span>
            <div>
              <p className="font-semibold">{l.seller.fullName}</p>
              <p className="text-xs text-slate-500">Batch of {l.seller.batch || '—'}</p>
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Stars value={l.seller.avgRating} size="text-sm" />
                {l.seller.avgRating ? <span>{l.seller.avgRating} · </span> : <span>No ratings · </span>}
                <span>{l.seller.completedTransactions} deals</span>
              </div>
            </div>
          </div>
          {!l.isOwner && user && <button onClick={() => setReport(true)} className="text-xs text-red-600 font-medium mt-3">⚑ Report this listing</button>}
        </div>

        <p className="text-[11px] text-slate-400 px-2">SoMart does not process payments. Meet on campus, inspect the item, and exchange handover OTPs only in person.</p>
      </div>

      <Confirm open={confirm} onClose={() => setConfirm(false)} onConfirm={interested}
        title={isRent ? 'Send rental request?' : 'Express interest?'}
        body={isRent ? `The owner will be notified. You'll agree on dates and amount before the OTP handover.` : `The seller will be notified and can accept your request. Payment happens in person — SoMart never processes payments.`}
        confirmLabel="Send request" />
      <Confirm open={report} onClose={() => setReport(false)} onConfirm={sendReport} title="Report this listing" confirmLabel="Submit report" danger>
        <div className="mt-3 space-y-3">
          <select className="input" value={reportForm.reason} onChange={e => setReportForm({ ...reportForm, reason: e.target.value })}>
            <option value="fake_listing">Fake listing</option><option value="fraud">Fraud attempt</option>
            <option value="misleading">Misleading description</option><option value="inappropriate">Inappropriate content</option>
            <option value="damaged_item">Damaged item dispute</option><option value="misconduct">User misconduct</option><option value="other">Other</option>
          </select>
          <textarea className="input" rows={3} placeholder="Details (optional)" value={reportForm.details} onChange={e => setReportForm({ ...reportForm, details: e.target.value })} />
        </div>
      </Confirm>
    </div>
  );
}
