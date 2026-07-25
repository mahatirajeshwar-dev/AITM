import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { ListingCard, Skeleton, Empty } from '../components/ui';

export default function Marketplace() {
  const [sp, setSp] = useSearchParams();
  const [listings, setListings] = useState<any[] | null>(null);
  const [cats, setCats] = useState<string[]>([]);
  const get = (k: string) => sp.get(k) || '';
  const set = (k: string, v: string) => { const n = new URLSearchParams(sp); v ? n.set(k, v) : n.delete(k); setSp(n); };

  useEffect(() => { api.get('/api/listings/categories').then(d => setCats(d.categories)); }, []);
  useEffect(() => {
    setListings(null);
    api.get('/api/listings?' + sp.toString()).then(d => setListings(d.listings)).catch(() => setListings([]));
  }, [sp]);

  return (
    <div className="grid lg:grid-cols-[240px_1fr] gap-6">
      <aside className="card p-4 h-fit lg:sticky lg:top-20 space-y-4">
        <h2 className="font-bold">Filters</h2>
        <div><label className="label">Search</label>
          <input className="input" defaultValue={get('q')} onKeyDown={e => e.key === 'Enter' && set('q', (e.target as HTMLInputElement).value)} placeholder="Press Enter to search" /></div>
        <div><label className="label">Type</label>
          <select className="input" value={get('type')} onChange={e => set('type', e.target.value)}>
            <option value="">All</option><option value="sale">For Sale</option><option value="rent">For Rent</option>
          </select></div>
        <div><label className="label">Category</label>
          <select className="input" value={get('category')} onChange={e => set('category', e.target.value)}>
            <option value="">All categories</option>{cats.map(c => <option key={c}>{c}</option>)}
          </select></div>
        <div><label className="label">Condition</label>
          <select className="input" value={get('condition')} onChange={e => set('condition', e.target.value)}>
            <option value="">Any</option><option value="new">New</option><option value="like_new">Like New</option><option value="good">Good</option><option value="fair">Fair</option>
          </select></div>
        <div className="grid grid-cols-2 gap-2">
          <div><label className="label">Min ₹</label><input className="input" type="number" defaultValue={get('minPrice')} onBlur={e => set('minPrice', e.target.value)} /></div>
          <div><label className="label">Max ₹</label><input className="input" type="number" defaultValue={get('maxPrice')} onBlur={e => set('maxPrice', e.target.value)} /></div>
        </div>
        <div><label className="label">Sort</label>
          <select className="input" value={get('sort')} onChange={e => set('sort', e.target.value)}>
            <option value="">Recently added</option><option value="price_asc">Price: low to high</option><option value="price_desc">Price: high to low</option>
          </select></div>
        <button className="btn-secondary w-full" onClick={() => setSp(new URLSearchParams())}>Clear filters</button>
      </aside>
      <div>
        <h1 className="text-2xl font-bold mb-4">Marketplace {get('q') && <span className="text-slate-400 font-normal text-lg">— “{get('q')}”</span>}</h1>
        {listings === null ? <Skeleton /> : listings.length === 0
          ? <Empty title="No listings found" sub="Try changing your filters or search." />
          : <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">{listings.map(l => <ListingCard key={l.id} l={l} />)}</div>}
      </div>
    </div>
  );
}
