import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useApp } from '../lib/store';
import { Spinner } from '../components/ui';

export default function CreateListing({ edit }: { edit?: boolean }) {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const { user, toast } = useApp();
  const nav = useNavigate();
  const [cats, setCats] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [loadingL, setLoadingL] = useState(!!edit);
  const [f, setF] = useState<any>({
    title: '', description: '', category: '', listingType: sp.get('type') === 'rent' ? 'rent' : 'sale',
    condition: 'good', price: '', rentalRate: '', rentalUnit: 'day', securityDeposit: '',
    minRentalPeriod: '', maxRentalPeriod: '', availableFrom: '', availableUntil: '',
    negotiable: false, location: '', images: [] as string[], status: 'active',
  });
  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));

  useEffect(() => { api.get('/api/listings/categories').then(d => setCats(d.categories)); }, []);
  useEffect(() => {
    if (edit && id) api.get(`/api/listings/${id}`).then(d => {
      const l = d.listing;
      setF({ ...l, price: l.price ?? '', rentalRate: l.rentalRate ?? '', securityDeposit: l.securityDeposit ?? '',
        minRentalPeriod: l.minRentalPeriod ?? '', maxRentalPeriod: l.maxRentalPeriod ?? '',
        availableFrom: l.availableFrom?.slice(0, 10) || '', availableUntil: l.availableUntil?.slice(0, 10) || '',
        images: l.images.map((im: any) => im.url) });
      setLoadingL(false);
    }).catch(e => { toast(e.message, 'error'); nav('/dashboard'); });
  }, [edit, id]);

  if (!user?.emailVerified) return (
    <div className="card p-12 text-center max-w-lg mx-auto">
      <h2 className="text-xl font-bold">Verify your email first</h2>
      <p className="text-slate-500 text-sm mt-2">Only verified students can create listings.</p>
      <button className="btn-primary mt-4" onClick={() => nav('/verify-email')}>Verify email</button>
    </div>
  );
  if (loadingL) return <Spinner />;

  const uploadFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    try { const urls = await api.upload(files); set('images', [...f.images, ...urls].slice(0, 8)); }
    catch (e: any) { toast(e.message, 'error'); }
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    try {
      const d = edit ? await api.put(`/api/listings/${id}`, f) : await api.post('/api/listings', f);
      toast(edit ? 'Listing updated!' : 'Listing published!');
      nav(`/listing/${d.listing.id}`);
    } catch (e: any) { toast(e.message, 'error'); } finally { setBusy(false); }
  };
  const isRent = f.listingType === 'rent';

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">{edit ? 'Edit Listing' : 'Create a Listing'}</h1>
      <form onSubmit={submit} className="card p-6 space-y-5">
        <div className="grid grid-cols-2 gap-3">
          {['sale', 'rent'].map(t => (
            <button type="button" key={t} onClick={() => set('listingType', t)}
              className={`rounded-2xl border-2 p-4 text-center font-semibold transition ${f.listingType === t ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-200 hover:border-slate-300'}`}>
              {t === 'sale' ? '🏷️ For Sale' : '🔄 For Rent'}
            </button>
          ))}
        </div>
        <div><label className="label">Item Title *</label><input className="input" required maxLength={80} value={f.title} onChange={e => set('title', e.target.value)} /></div>
        <div><label className="label">Description *</label><textarea className="input" rows={4} required value={f.description} onChange={e => set('description', e.target.value)} /></div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div><label className="label">Category *</label>
            <select className="input" required value={f.category} onChange={e => set('category', e.target.value)}>
              <option value="">Select…</option>{cats.map(c => <option key={c}>{c}</option>)}
            </select></div>
          <div><label className="label">Condition *</label>
            <select className="input" value={f.condition} onChange={e => set('condition', e.target.value)}>
              <option value="new">New</option><option value="like_new">Like New</option><option value="good">Good</option><option value="fair">Fair</option>
            </select></div>
        </div>
        {!isRent ? (
          <div className="grid sm:grid-cols-2 gap-4 items-end">
            <div><label className="label">Selling Price (₹) *</label><input className="input" type="number" min="1" required value={f.price} onChange={e => set('price', e.target.value)} /></div>
            <label className="flex items-center gap-2 pb-3 text-sm font-medium"><input type="checkbox" className="h-4 w-4" checked={f.negotiable} onChange={e => set('negotiable', e.target.checked)} /> Price is negotiable</label>
          </div>
        ) : (
          <div className="space-y-4 rounded-2xl bg-indigo-50/50 border border-indigo-100 p-4">
            <div className="grid sm:grid-cols-3 gap-4">
              <div><label className="label">Rental Price (₹) *</label><input className="input" type="number" min="1" required value={f.rentalRate} onChange={e => set('rentalRate', e.target.value)} /></div>
              <div><label className="label">Pricing Unit *</label>
                <select className="input" value={f.rentalUnit} onChange={e => set('rentalUnit', e.target.value)}>
                  <option value="day">Per Day</option><option value="week">Per Week</option><option value="month">Per Month</option>
                </select></div>
              <div><label className="label">Security Deposit (₹)</label><input className="input" type="number" min="0" value={f.securityDeposit} onChange={e => set('securityDeposit', e.target.value)} /></div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div><label className="label">Min Rental Period ({f.rentalUnit}s)</label><input className="input" type="number" min="1" value={f.minRentalPeriod} onChange={e => set('minRentalPeriod', e.target.value)} /></div>
              <div><label className="label">Max Rental Period ({f.rentalUnit}s)</label><input className="input" type="number" min="1" value={f.maxRentalPeriod} onChange={e => set('maxRentalPeriod', e.target.value)} /></div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div><label className="label">Available From</label><input className="input" type="date" value={f.availableFrom} onChange={e => set('availableFrom', e.target.value)} /></div>
              <div><label className="label">Available Until</label><input className="input" type="date" value={f.availableUntil} onChange={e => set('availableUntil', e.target.value)} /></div>
            </div>
            <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" className="h-4 w-4" checked={f.negotiable} onChange={e => set('negotiable', e.target.checked)} /> Rate is negotiable</label>
          </div>
        )}
        <div><label className="label">Pickup Location *</label><input className="input" required placeholder="e.g. Hostel Block C, Main Gate" value={f.location} onChange={e => set('location', e.target.value)} /></div>
        <div>
          <label className="label">Images (up to 8)</label>
          <div className="flex flex-wrap gap-3">
            {f.images.map((u: string, i: number) => (
              <div key={i} className="relative h-20 w-24 rounded-xl overflow-hidden border border-slate-200">
                <img src={u} className="w-full h-full object-cover" />
                <button type="button" onClick={() => set('images', f.images.filter((_: any, j: number) => j !== i))}
                  className="absolute top-0.5 right-0.5 h-5 w-5 rounded-full bg-black/60 text-white text-xs">×</button>
              </div>
            ))}
            {f.images.length < 8 && (
              <label className="h-20 w-24 rounded-xl border-2 border-dashed border-slate-300 grid place-items-center cursor-pointer text-slate-400 hover:border-brand-400 hover:text-brand-500">
                <span className="text-2xl">+</span>
                <input type="file" accept="image/*" multiple className="hidden" onChange={e => uploadFiles(e.target.files)} />
              </label>
            )}
          </div>
        </div>
        {edit && ['active','paused','inactive'].includes(f.status) && (
          <div><label className="label">Listing status</label>
            <select className="input" value={f.status} onChange={e => set('status', e.target.value)}>
              <option value="active">Active</option><option value="paused">Paused</option><option value="inactive">Unavailable / Inactive</option>
            </select></div>
        )}
        <button className="btn-primary w-full !py-3" disabled={busy}>{busy ? 'Saving…' : edit ? 'Save changes' : 'Publish listing'}</button>
      </form>
    </div>
  );
}
