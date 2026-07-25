import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, timeAgo } from '../lib/api';
import { useApp } from '../lib/store';
import { Spinner, Empty } from '../components/ui';

export default function Messages() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user, toast, refreshCounts } = useApp();
  const [convos, setConvos] = useState<any[] | null>(null);
  const [convo, setConvo] = useState<any>(null);
  const [body, setBody] = useState('');
  const bottom = useRef<HTMLDivElement>(null);

  const loadList = () => api.get('/api/messages').then(d => setConvos(d.conversations)).catch(() => setConvos([]));
  const loadConvo = () => id && api.get(`/api/messages/${id}`).then(d => { setConvo(d.conversation); refreshCounts(); }).catch(e => toast(e.message, 'error'));
  useEffect(() => { loadList(); }, [id]);
  useEffect(() => { setConvo(null); loadConvo(); const iv = setInterval(loadConvo, 6000); return () => clearInterval(iv); }, [id]);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'smooth' }); }, [convo?.messages?.length]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    try { await api.post(`/api/messages/${id}`, { body }); setBody(''); loadConvo(); loadList(); }
    catch (e: any) { toast(e.message, 'error'); }
  };

  if (!convos) return <Spinner />;
  return (
    <div className="grid md:grid-cols-[300px_1fr] gap-4 h-[calc(100vh-160px)]">
      <aside className={`card overflow-y-auto ${id ? 'hidden md:block' : ''}`}>
        <h2 className="font-bold p-4 pb-2">Messages</h2>
        {convos.length === 0 && <p className="p-4 text-sm text-slate-500">No conversations yet. Contact a seller from any listing.</p>}
        {convos.map(c => (
          <button key={c.id} onClick={() => nav(`/messages/${c.id}`)}
            className={`w-full text-left px-4 py-3 border-t border-slate-100 hover:bg-slate-50 ${c.id === id ? 'bg-brand-50' : ''}`}>
            <div className="flex items-center justify-between">
              <p className="font-semibold text-sm">{c.other?.fullName}</p>
              {c.unread > 0 && <span className="h-5 min-w-5 px-1 rounded-full bg-brand-600 text-white text-[10px] grid place-items-center font-bold">{c.unread}</span>}
            </div>
            {c.listingTitle && <p className="text-[11px] text-brand-600 truncate">re: {c.listingTitle}</p>}
            <p className="text-xs text-slate-500 truncate">{c.lastMessage?.body || 'Start the conversation'}</p>
            <p className="text-[10px] text-slate-400">{timeAgo(c.updatedAt)}</p>
          </button>
        ))}
      </aside>
      <div className={`card flex flex-col ${!id ? 'hidden md:flex' : ''}`}>
        {!id ? <Empty title="Select a conversation" sub="Chat about availability, price, pickup and more." /> : !convo ? <Spinner /> : <>
          <div className="p-4 border-b border-slate-200 flex items-center gap-3">
            <button className="md:hidden text-xl" onClick={() => nav('/messages')}>←</button>
            <span className="h-9 w-9 rounded-full bg-brand-100 text-brand-700 grid place-items-center font-bold">{convo.other.fullName[0]}</span>
            <p className="font-semibold">{convo.other.fullName}</p>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {convo.messages.map((m: any) => (
              <div key={m.id} className={`flex ${m.senderId === user.id ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${m.senderId === user.id ? 'bg-brand-600 text-white rounded-br-md' : 'bg-slate-100 rounded-bl-md'}`}>
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  <p className={`text-[10px] mt-0.5 ${m.senderId === user.id ? 'text-brand-200' : 'text-slate-400'}`}>{timeAgo(m.createdAt)}</p>
                </div>
              </div>
            ))}
            <div ref={bottom} />
          </div>
          <form onSubmit={send} className="p-3 border-t border-slate-200 flex gap-2">
            <input className="input flex-1" placeholder="Type a message…" value={body} onChange={e => setBody(e.target.value)} />
            <button className="btn-primary">Send</button>
          </form>
          <p className="text-[10px] text-slate-400 text-center pb-2 px-4">Phone numbers are never shared automatically — share your own contact details only if you choose to.</p>
        </>}
      </div>
    </div>
  );
}
