import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, money, fmtDate } from '../lib/api';
import { useApp } from '../lib/store';
import { Spinner, StatusBadge, Stars, Confirm, img } from '../components/ui';

const STEPS = ['Request', 'Accepted', 'Agree Amount', 'OTP Handover', 'Done'];
const stepOf = (s: string, rental: boolean) => {
  if (s === 'request_sent') return 0;
  if (s === 'deal_in_progress') return 2;
  if (s === 'awaiting_handover') return 3;
  if (['rented','awaiting_return'].includes(s)) return 4;
  if (s === 'completed') return 5;
  return -1;
};

function OtpPanel({ t, phase, myOtp, onVerified, toast }: any) {
  const [code, setCode] = useState('');
  const [shownOtp, setShownOtp] = useState<string | null>(myOtp || null);
  const otp = phase === 'return' ? t.returnOtp : t.handoverOtp;
  const iVerified = t.myRole === 'buyer' ? otp?.sellerOtpVerified : otp?.buyerOtpVerified; // I verify the other party's OTP
  const otherVerified = t.myRole === 'buyer' ? otp?.buyerOtpVerified : otp?.sellerOtpVerified;
  const expired = otp && new Date(otp.expiresAt) < new Date();
  const otherRole = t.myRole === 'buyer' ? (t.transactionType === 'rental' ? 'owner' : 'seller') : (t.transactionType === 'rental' ? 'renter' : 'buyer');

  const verify = async () => {
    try {
      const d = await api.post(`/api/transactions/${t.id}/otp/verify`, { code, phase });
      toast(d.bothVerified ? 'Both OTPs verified! ✅' : 'OTP verified. Waiting for the other party.');
      onVerified();
    } catch (e: any) { toast(e.message, 'error'); onVerified(); }
    setCode('');
  };
  const regen = async () => {
    try { const d = await api.post(`/api/transactions/${t.id}/otp/regenerate`, { phase }); setShownOtp(d.myOtp); toast('New OTP generated — only your code changed.'); onVerified(); }
    catch (e: any) { toast(e.message, 'error'); }
  };

  return (
    <div className="card p-5 border-purple-200">
      <h2 className="font-bold text-lg">{phase === 'return' ? '🔁 Return Verification' : '🤝 Handover Verification'}</h2>
      <p className="text-sm text-slate-600 mt-1">Meet in person. Exchange OTPs <b>only during the physical {phase === 'return' ? 'return' : 'handover'}</b>. The deal completes when both of you verify.</p>

      <div className="grid sm:grid-cols-2 gap-4 mt-4">
        <div className="rounded-2xl bg-brand-50 border border-brand-200 p-4 text-center">
          <p className="text-xs font-bold text-brand-700 uppercase">Your OTP — give it to the {otherRole}</p>
          {shownOtp ? <p className="text-3xl font-extrabold tracking-[0.3em] mt-2">{shownOtp}</p>
            : <div className="mt-2">
                <p className="text-sm text-slate-500">Your OTP was shown when it was generated. Lost it? Generate a new one (only replaces your code).</p>
                <button className="btn-secondary mt-2" onClick={regen} disabled={otp?.buyerOtpVerified || otp?.sellerOtpVerified}>Show my OTP (regenerate)</button>
              </div>}
          <p className="text-[11px] text-slate-500 mt-2">Never share this before you physically hand over / receive the item.</p>
        </div>
        <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4">
          <p className="text-xs font-bold text-slate-600 uppercase text-center">Enter the {otherRole}'s OTP</p>
          {iVerified ? <p className="text-center mt-4 text-emerald-600 font-bold">✓ Verified {}</p> : expired ? (
            <div className="text-center mt-3">
              <p className="text-sm text-red-600 font-medium">OTPs expired.</p>
              <button className="btn-secondary mt-2" onClick={regen}>Regenerate OTPs</button>
            </div>
          ) : <>
            <input className="input text-center text-xl tracking-[0.4em] font-bold mt-2" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} placeholder="••••••" />
            <button className="btn-primary w-full mt-2" onClick={verify} disabled={code.length !== 6}>Verify OTP</button>
            {otp && <p className="text-[11px] text-slate-500 text-center mt-1.5">{otp.myAttemptsLeft} attempts left · expires {new Date(otp.expiresAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>}
          </>}
        </div>
      </div>
      <div className="flex justify-center gap-6 mt-4 text-sm">
        <span className={otp?.buyerOtpVerified ? 'text-emerald-600 font-semibold' : 'text-slate-400'}>{otp?.buyerOtpVerified ? '✓' : '○'} Buyer OTP verified</span>
        <span className={otp?.sellerOtpVerified ? 'text-emerald-600 font-semibold' : 'text-slate-400'}>{otp?.sellerOtpVerified ? '✓' : '○'} Seller OTP verified</span>
      </div>
      {otherVerified && !iVerified && <p className="text-center text-xs text-amber-700 bg-amber-50 rounded-xl p-2 mt-3">The other party has verified your OTP. Enter theirs to complete.</p>}
    </div>
  );
}

export default function TransactionDetail() {
  const { id } = useParams();
  const { toast } = useApp();
  const [t, setT] = useState<any>(null);
  const [err, setErr] = useState('');
  const [myOtp, setMyOtp] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [rental, setRental] = useState({ rentalStartDate: '', rentalEndDate: '', securityDeposit: '' });
  const [cancel, setCancel] = useState(false);
  const [review, setReview] = useState({ rating: 0, comment: '' });

  const load = () => api.get(`/api/transactions/${id}`).then(d => {
    setT(d.transaction);
    if (d.transaction.agreedAmount) setAmount(String(d.transaction.agreedAmount));
    const rd = d.transaction.rentalDetail;
    if (rd) setRental({ rentalStartDate: rd.rentalStartDate?.slice(0,10) || '', rentalEndDate: rd.rentalEndDate?.slice(0,10) || '', securityDeposit: rd.securityDeposit ?? '' });
  }).catch(e => setErr(e.message));
  useEffect(() => { load(); const iv = setInterval(load, 8000); return () => clearInterval(iv); }, [id]);

  if (err) return <div className="card p-12 text-center"><h2 className="text-xl font-bold">{err}</h2></div>;
  if (!t) return <Spinner />;

  const isBuyer = t.myRole === 'buyer';
  const isRental = t.transactionType === 'rental';
  const other = isBuyer ? t.seller : t.buyer;
  const myConfirmed = isBuyer ? t.buyerAmountConfirmed : t.sellerAmountConfirmed;
  const otherConfirmed = isBuyer ? t.sellerAmountConfirmed : t.buyerAmountConfirmed;
  const act = async (fn: () => Promise<any>) => { try { const d = await fn(); if (d?.myOtp) setMyOtp(d.myOtp); load(); return d; } catch (e: any) { toast(e.message, 'error'); } };

  const step = stepOf(t.status, isRental);

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="card p-5">
        <div className="flex items-center gap-4 flex-wrap">
          <img src={img(t.listing)} className="h-16 w-20 rounded-xl object-cover" />
          <div className="flex-1 min-w-0">
            <Link to={`/listing/${t.listingId}`} className="font-bold text-lg hover:text-brand-700">{t.listing?.title}</Link>
            <p className="text-sm text-slate-500 capitalize">{t.transactionType} · {isBuyer ? `${isRental ? 'Owner' : 'Seller'}: ${other?.fullName}` : `${isRental ? 'Renter' : 'Buyer'}: ${other?.fullName}`} · {fmtDate(t.createdAt)}</p>
          </div>
          <StatusBadge status={t.status} />
        </div>
        {step >= 0 && step < 5 && (
          <div className="flex items-center mt-5">
            {STEPS.map((s, i) => (
              <React.Fragment key={s}>
                <div className="flex flex-col items-center">
                  <span className={`h-7 w-7 rounded-full grid place-items-center text-xs font-bold ${i < step ? 'bg-emerald-500 text-white' : i === step ? 'bg-brand-600 text-white' : 'bg-slate-200 text-slate-500'}`}>{i < step ? '✓' : i + 1}</span>
                  <span className="text-[10px] mt-1 text-slate-500 hidden sm:block">{s}</span>
                </div>
                {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 mx-1 ${i < step ? 'bg-emerald-400' : 'bg-slate-200'}`} />}
              </React.Fragment>
            ))}
          </div>
        )}
        <div className="grid grid-cols-3 gap-3 mt-5 text-center">
          <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Listed</p><p className="font-bold">{money(t.listedAmount)}{isRental && t.rentalDetail?.rentalUnit ? `/${t.rentalDetail.rentalUnit}` : ''}</p></div>
          <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Agreed{isRental ? ' (total)' : ''}</p><p className="font-bold text-brand-700">{money(t.agreedAmount) || '—'}</p></div>
          <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Tx ID</p><p className="font-mono text-xs pt-1.5">{t.id.slice(-8)}</p></div>
        </div>
        {isRental && t.rentalDetail?.rentalStartDate && (
          <p className="text-sm text-center mt-3 text-slate-600">Rental period: <b>{fmtDate(t.rentalDetail.rentalStartDate)}</b> → <b>{fmtDate(t.rentalDetail.rentalEndDate)}</b>{t.rentalDetail.securityDeposit ? <> · Deposit: <b>{money(t.rentalDetail.securityDeposit)}</b></> : null}</p>
        )}
      </div>

      {t.status === 'request_sent' && (isBuyer
        ? <div className="card p-5 text-center"><p className="font-medium">⏳ Waiting for {other?.firstName} to respond to your request.</p>
            <button className="btn-secondary mt-3" onClick={() => setCancel(true)}>Cancel request</button></div>
        : <div className="card p-5 text-center">
            <p className="font-medium mb-3">📩 {other?.firstName} {isRental ? 'wants to rent' : 'is interested in'} this item.</p>
            <div className="flex justify-center gap-3">
              <button className="btn-primary px-8" onClick={() => act(() => api.post(`/api/transactions/${t.id}/respond`, { action: 'accept' }))}>Accept</button>
              <button className="btn-danger px-8" onClick={() => act(() => api.post(`/api/transactions/${t.id}/respond`, { action: 'reject' }))}>Reject</button>
            </div>
          </div>)}

      {t.status === 'deal_in_progress' && (
        <div className="card p-5">
          <h2 className="font-bold text-lg">💬 Agree on the final {isRental ? 'rental terms' : 'amount'}</h2>
          <p className="text-sm text-slate-600 mt-1">Both parties must confirm the same {isRental ? 'terms' : 'amount'} before OTPs are generated. Payment happens in person — SoMart never processes payments.</p>
          <div className="mt-4 space-y-3">
            {isRental && <div className="grid sm:grid-cols-3 gap-3">
              <div><label className="label">Start date</label><input type="date" className="input" value={rental.rentalStartDate} onChange={e => setRental({ ...rental, rentalStartDate: e.target.value })} /></div>
              <div><label className="label">End date</label><input type="date" className="input" value={rental.rentalEndDate} onChange={e => setRental({ ...rental, rentalEndDate: e.target.value })} /></div>
              <div><label className="label">Deposit (₹)</label><input type="number" className="input" value={rental.securityDeposit} onChange={e => setRental({ ...rental, securityDeposit: e.target.value })} /></div>
            </div>}
            <div className="flex gap-3 items-end">
              <div className="flex-1"><label className="label">{isRental ? 'Total agreed rental amount (₹)' : 'Final agreed amount (₹)'}</label>
                <input type="number" className="input" value={amount} onChange={e => setAmount(e.target.value)} /></div>
              <button className="btn-primary" onClick={() => act(() => api.post(`/api/transactions/${t.id}/agree`, isRental ? { totalRentalAmount: amount, ...rental } : { amount }))}>
                {t.agreedAmount && Number(amount) === t.agreedAmount && !myConfirmed ? 'Confirm' : t.agreedAmount ? 'Propose' : 'Propose'} {money(Number(amount) || 0)}
              </button>
            </div>
            <div className="flex gap-4 text-sm">
              <span className={t.buyerAmountConfirmed ? 'text-emerald-600 font-semibold' : 'text-slate-400'}>{t.buyerAmountConfirmed ? '✓' : '○'} {isRental ? 'Renter' : 'Buyer'} confirmed</span>
              <span className={t.sellerAmountConfirmed ? 'text-emerald-600 font-semibold' : 'text-slate-400'}>{t.sellerAmountConfirmed ? '✓' : '○'} {isRental ? 'Owner' : 'Seller'} confirmed</span>
            </div>
            {t.agreedAmount && otherConfirmed && !myConfirmed && <p className="text-sm bg-amber-50 text-amber-800 rounded-xl p-3">{other?.firstName} proposed <b>{money(t.agreedAmount)}</b>. Enter the same amount and confirm to proceed to OTP handover.</p>}
          </div>
        </div>
      )}

      {myOtp && <div className="card p-5 border-emerald-300 bg-emerald-50/50 text-center">
        <p className="font-bold text-emerald-800">🔐 Your OTP (save it — shown once)</p>
        <p className="text-4xl font-extrabold tracking-[0.3em] mt-2">{myOtp}</p>
        <p className="text-xs text-slate-600 mt-2">Give this to the other party ONLY during the physical exchange.</p>
      </div>}

      {t.status === 'awaiting_handover' && <OtpPanel t={t} phase="handover" myOtp={myOtp} onVerified={load} toast={toast} />}
      {t.status === 'awaiting_return' && <OtpPanel t={t} phase="return" myOtp={myOtp} onVerified={load} toast={toast} />}

      {t.status === 'rented' && (
        <div className="card p-5 text-center">
          <p className="font-medium">📦 Item is currently rented{t.rentalDetail?.rentalEndDate ? ` until ${fmtDate(t.rentalDetail.rentalEndDate)}` : ''}.</p>
          <button className="btn-primary mt-3" onClick={() => act(() => api.post(`/api/transactions/${t.id}/start-return`))}>Start return process</button>
          <p className="text-xs text-slate-500 mt-2">This generates return OTPs for both parties to verify during the physical return.</p>
        </div>
      )}

      {t.status === 'completed' && (
        <div className="card p-5">
          <p className="text-center font-bold text-emerald-700 text-lg">🎉 Transaction completed on {fmtDate(t.completedAt)}</p>
          {!t.myReviewDone ? (
            <div className="mt-4 max-w-sm mx-auto text-center">
              <p className="font-semibold text-sm mb-2">Rate {other?.firstName}</p>
              <Stars value={review.rating} onChange={v => setReview({ ...review, rating: v })} size="text-3xl" />
              <textarea className="input mt-3" rows={2} placeholder="Optional review comment" value={review.comment} onChange={e => setReview({ ...review, comment: e.target.value })} />
              <button className="btn-primary w-full mt-2" disabled={!review.rating}
                onClick={() => act(async () => { await api.post(`/api/transactions/${t.id}/review`, review); toast('Review submitted!'); })}>Submit review</button>
            </div>
          ) : <p className="text-center text-sm text-slate-500 mt-2">You've reviewed this transaction. ✓</p>}
        </div>
      )}

      <div className="flex justify-center gap-3">
        <button className="btn-secondary" onClick={() => act(async () => { const d = await api.post('/api/messages/start', { userId: other.id, listingId: t.listingId }); location.assign(`/messages/${d.conversationId}`); })}>💬 Message {other?.firstName}</button>
        {!['completed','cancelled','rejected','rented','awaiting_return'].includes(t.status) && (
          <button className="btn-secondary !text-red-600" onClick={() => setCancel(true)}>Cancel deal</button>
        )}
      </div>

      <Confirm open={cancel} onClose={() => setCancel(false)} danger title="Cancel this deal?" body="The other party will be notified and the listing becomes available again." confirmLabel="Cancel deal"
        onConfirm={() => { act(() => api.post(`/api/transactions/${t.id}/cancel`)); setCancel(false); }} />
    </div>
  );
}
