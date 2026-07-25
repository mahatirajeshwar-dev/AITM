import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { money, condLabel, timeAgo, rentalUnitLabel, statusLabel, statusColor } from '../lib/api';

export const Spinner = () => <div className="flex justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" /></div>;

export const Skeleton = ({ n = 8 }: { n?: number }) => (
  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
    {Array.from({ length: n }).map((_, i) => (
      <div key={i} className="card overflow-hidden animate-pulse">
        <div className="aspect-[4/3] bg-slate-200" />
        <div className="p-3 space-y-2"><div className="h-4 bg-slate-200 rounded w-3/4" /><div className="h-4 bg-slate-200 rounded w-1/2" /></div>
      </div>
    ))}
  </div>
);

export const Empty = ({ title, sub, action }: { title: string; sub?: string; action?: React.ReactNode }) => (
  <div className="card p-12 text-center">
    <div className="text-4xl mb-3">🛍️</div>
    <h3 className="font-semibold text-lg">{title}</h3>
    {sub && <p className="text-slate-500 text-sm mt-1">{sub}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

export const StatusBadge = ({ status }: { status: string }) => (
  <span className={`badge ${statusColor[status] || 'bg-slate-100 text-slate-700'}`}>{statusLabel[status] || status}</span>
);

export function Stars({ value, onChange, size = 'text-lg' }: { value: number | null; onChange?: (v: number) => void; size?: string }) {
  return <span className={`${size} select-none`}>
    {[1,2,3,4,5].map(i => (
      <button key={i} type="button" disabled={!onChange} onClick={() => onChange?.(i)}
        className={`${(value || 0) >= i ? 'text-amber-400' : 'text-slate-300'} ${onChange ? 'hover:scale-110 transition' : 'cursor-default'}`}>★</button>
    ))}
  </span>;
}

export function Confirm({ open, title, body, confirmLabel = 'Confirm', danger, onConfirm, onClose, children }:
  { open: boolean; title: string; body?: string; confirmLabel?: string; danger?: boolean; onConfirm: () => void; onClose: () => void; children?: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="card p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <h3 className="font-bold text-lg">{title}</h3>
        {body && <p className="text-slate-600 text-sm mt-2">{body}</p>}
        {children}
        <div className="flex justify-end gap-2 mt-5">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className={danger ? 'btn-danger' : 'btn-primary'} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

export const img = (l: any) => l?.images?.[0]?.url || `https://placehold.co/600x450/e2e8f0/64748b?text=${encodeURIComponent(l?.category || 'Item')}`;

export function ListingCard({ l }: { l: any }) {
  const isRent = l.listingType === 'rent';
  return (
    <Link to={`/listing/${l.id}`} className="card overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition group">
      <div className="aspect-[4/3] bg-slate-100 overflow-hidden relative">
        <img src={img(l)} alt={l.title} className="w-full h-full object-cover group-hover:scale-105 transition duration-300" loading="lazy" />
        <span className={`badge absolute top-2 left-2 ${isRent ? 'bg-indigo-600 text-white' : 'bg-emerald-600 text-white'}`}>{isRent ? 'For Rent' : 'For Sale'}</span>
        {l.status !== 'active' && <span className="badge absolute top-2 right-2 bg-slate-900/80 text-white">{statusLabel[l.status]}</span>}
      </div>
      <div className="p-3">
        <h3 className="font-semibold text-sm truncate">{l.title}</h3>
        <p className="text-brand-700 font-bold mt-0.5">
          {isRent ? <>{money(l.rentalRate)}<span className="text-xs font-medium text-slate-500">{rentalUnitLabel[l.rentalUnit] || ''}</span></> : money(l.price)}
          {l.negotiable && <span className="text-[11px] font-medium text-slate-400 ml-1.5">Negotiable</span>}
        </p>
        <div className="flex items-center justify-between mt-1.5 text-xs text-slate-500">
          <span>{condLabel[l.condition] || l.condition} · {l.seller?.firstName || ''}</span>
          <span>{timeAgo(l.createdAt)}</span>
        </div>
      </div>
    </Link>
  );
}
