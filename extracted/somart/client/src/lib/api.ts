export class ApiError extends Error { status: number; constructor(msg: string, status: number) { super(msg); this.status = status; } }

async function req(method: string, url: string, body?: any) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'include',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || 'Request failed', res.status);
  return data;
}
export const api = {
  get: (url: string) => req('GET', url),
  post: (url: string, body?: any) => req('POST', url, body),
  put: (url: string, body?: any) => req('PUT', url, body),
  del: (url: string) => req('DELETE', url),
  async upload(files: FileList | File[]) {
    const fd = new FormData();
    Array.from(files).forEach(f => fd.append('images', f));
    const res = await fetch('/api/upload', { method: 'POST', body: fd, credentials: 'include' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(data.error || 'Upload failed', res.status);
    return data.urls as string[];
  },
};

export const money = (n?: number | null) => n == null ? '' : '₹' + Number(n).toLocaleString('en-IN');
export const timeAgo = (d: string | Date) => {
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};
export const fmtDate = (d?: string | null) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
export const condLabel: Record<string, string> = { new: 'New', like_new: 'Like New', good: 'Good', fair: 'Fair' };
export const statusLabel: Record<string, string> = {
  request_sent: 'Request Sent', accepted: 'Accepted', deal_in_progress: 'Deal in Progress',
  awaiting_handover: 'Awaiting Handover', completed: 'Completed', cancelled: 'Cancelled', rejected: 'Rejected',
  rented: 'Rented', awaiting_return: 'Awaiting Return', returned: 'Returned',
  active: 'Active', paused: 'Paused', sold: 'Sold', inactive: 'Inactive', removed: 'Removed', deleted: 'Deleted',
};
export const statusColor: Record<string, string> = {
  request_sent: 'bg-amber-100 text-amber-800', deal_in_progress: 'bg-blue-100 text-blue-800',
  awaiting_handover: 'bg-purple-100 text-purple-800', completed: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-slate-200 text-slate-600', rejected: 'bg-red-100 text-red-700',
  rented: 'bg-indigo-100 text-indigo-800', awaiting_return: 'bg-orange-100 text-orange-800',
  active: 'bg-emerald-100 text-emerald-800', paused: 'bg-amber-100 text-amber-800',
  sold: 'bg-slate-800 text-white', inactive: 'bg-slate-200 text-slate-600', removed: 'bg-red-100 text-red-700',
};
export const rentalUnitLabel: Record<string, string> = { day: '/day', week: '/week', month: '/month' };
