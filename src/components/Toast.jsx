import { useEffect, useState } from 'react';
import { Send, X, MessageSquareText } from 'lucide-react';
import Avatar from './Avatar';

/** Desktop-style actionable in-app notification. OS toasts remain controlled by the browser. */
export default function Toast({ toast, onClose, onOpen, onReply }) {
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { setDraft(''); setError(''); }, [toast?._raw?.id]);
  useEffect(() => {
    if (!toast || draft || sending) return;
    const timer = setTimeout(onClose, 7000);
    return () => clearTimeout(timer);
  }, [toast, onClose, draft, sending]);
  if (!toast) return null;
  const reply = async (event) => {
    event.preventDefault(); event.stopPropagation();
    const value = draft.trim();
    if (!value || sending) return;
    setSending(true); setError('');
    try { await onReply?.(value); setDraft(''); onClose(); }
    catch (e) { setError(e?.message || 'Could not send reply.'); }
    finally { setSending(false); }
  };
  return (
    <section role="status" aria-live="polite" className="fixed right-3 top-3 sm:right-5 sm:top-5 z-[120] w-[370px] max-w-[calc(100vw-1.5rem)] rounded-2xl border border-white/10 bg-[#242529] text-white shadow-[0_18px_60px_rgba(0,0,0,.35)] p-4 animate-pop-in">
      <div className="flex items-start gap-3">
        <Avatar name={toast.from} src={toast.avatar} size={42} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5"><strong className="text-sm truncate">{toast.from}</strong><span className="ml-auto text-[11px] text-white/60">{toast.time || 'just now'}</span></div>
          <p className="text-sm leading-snug text-slate-200 break-words line-clamp-3 mt-1">{toast.preview}</p>
        </div>
        <button aria-label="Dismiss notification" className="p-1 rounded-lg hover:bg-white/10" onClick={onClose}><X size={16}/></button>
      </div>
      {toast.canReply ? (
        <form className="flex gap-2 mt-3" onSubmit={reply}>
          <input className="min-w-0 flex-1 bg-[#34363b] rounded-lg border border-white/20 px-3 py-2 text-sm outline-none focus:border-violet-400"
            value={draft} onChange={e => setDraft(e.target.value)} placeholder="Type a reply…" aria-label="Quick reply" />
          <button type="submit" disabled={sending || !draft.trim()} aria-label="Send quick reply" className="px-3 rounded-lg bg-violet-600 disabled:opacity-50"><Send size={17}/></button>
        </form>
      ) : (
        <button className="mt-3 text-sm flex gap-2 items-center text-violet-300 hover:underline" onClick={onOpen}><MessageSquareText size={15}/> Open chat</button>
      )}
      {error && <p role="alert" className="text-red-300 text-xs mt-2">{error}</p>}
    </section>
  );
}
