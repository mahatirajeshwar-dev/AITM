import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { ListingCard, Skeleton } from '../components/ui';

const catIcons: Record<string, string> = { Books: '📚', Electronics: '💻', Furniture: '🪑', Cycles: '🚲', 'Sports Equipment': '🏸', 'Room Essentials': '🛏️', 'Kitchen Items': '🍳', 'Academic Supplies': '✏️', Fashion: '👔', 'Event Tickets': '🎟️', Other: '📦' };

function Section({ title, items, link }: { title: string; items: any[]; link: string }) {
  if (!items?.length) return null;
  return (
    <section className="mt-10">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-bold">{title}</h2>
        <Link to={link} className="text-sm font-semibold text-brand-600">View all →</Link>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {items.slice(0, 8).map(l => <ListingCard key={l.id} l={l} />)}
      </div>
    </section>
  );
}

export default function Home() {
  const [data, setData] = useState<any>(null);
  const [q, setQ] = useState('');
  const nav = useNavigate();
  useEffect(() => { api.get('/api/listings/home').then(setData).catch(() => setData({})); }, []);
  return (
    <div>
      <section className="rounded-3xl bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900 text-white p-8 md:p-14 text-center">
        <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight">Your Campus. Your Marketplace.</h1>
        <p className="mt-3 text-brand-100 max-w-xl mx-auto">Buy, sell and rent with fellow students — textbooks, cycles, electronics and more. Deals sealed in person with secure dual-OTP handover.</p>
        <form onSubmit={e => { e.preventDefault(); nav(`/marketplace?q=${encodeURIComponent(q)}`); }} className="mt-6 max-w-lg mx-auto flex gap-2">
          <input className="input flex-1 !py-3" placeholder="Search books, cycles, electronics…" value={q} onChange={e => setQ(e.target.value)} />
          <button className="btn bg-white text-brand-700 hover:bg-brand-50 !py-3 px-6">Search</button>
        </form>
        <div className="mt-5 flex justify-center gap-3 flex-wrap">
          <Link to="/create?type=sale" className="btn bg-emerald-500 hover:bg-emerald-600 text-white px-6">Sell an Item</Link>
          <Link to="/create?type=rent" className="btn bg-indigo-500 hover:bg-indigo-600 text-white px-6">Rent Out an Item</Link>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-bold mb-3">Browse Categories</h2>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-11 gap-3">
          {(data?.categories || Object.keys(catIcons)).map((c: string) => (
            <Link key={c} to={`/marketplace?category=${encodeURIComponent(c)}`} className="card p-3 text-center hover:shadow-md hover:-translate-y-0.5 transition">
              <div className="text-2xl">{catIcons[c] || '📦'}</div>
              <div className="text-[11px] font-semibold mt-1 leading-tight">{c}</div>
            </Link>
          ))}
        </div>
      </section>

      {!data ? <div className="mt-10"><Skeleton /></div> : <>
        <Section title="Recently Added" items={data.recent} link="/marketplace?sort=recent" />
        <Section title="Popular Listings" items={data.popular} link="/marketplace" />
        <Section title="Items for Sale" items={data.sale} link="/marketplace?type=sale" />
        <Section title="Items for Rent" items={data.rent} link="/marketplace?type=rent" />
      </>}

      <section className="mt-12 card p-6 text-center">
        <p className="text-xs text-slate-500 max-w-2xl mx-auto"><b>Disclaimer:</b> SoMart only facilitates connections between students. All payments and settlements are handled directly between users. The platform does not process or guarantee payments and is not responsible for payment-related disputes.</p>
      </section>
    </div>
  );
}
