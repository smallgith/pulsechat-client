import { useEffect, useRef, useState } from 'react';
import { Send, X, MessageSquareText } from 'lucide-react';
import Avatar from './Avatar';

/** Keep an active reply attached to its original chat while later alerts arrive. */
export default function Toast({ toast, onClose, onOpen, onReply }) {
  const [current, setCurrent] = useState(null);
  const [draft, setDraft] = useState('');
  const [focused, setFocused] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const input = useRef(null);
  const closeHandler = useRef(onClose);
  closeHandler.current = onClose;
  useEffect(() => {
    if (!toast) {
      setCurrent(null);
      setDraft('');
      setError('');
      return;
    }
    if (!current || (current !== toast && !draft && !focused && !sending)) {
      setCurrent(toast);
      setDraft(toast.draft || '');
      setError(toast.error || '');
    }
  }, [toast, current, draft, focused, sending]);
  useEffect(() => {
    if (current?.autoFocus) input.current?.focus();
  }, [current]);
  useEffect(() => {
    if (!current || draft || focused || sending || current.autoFocus) return;
    const timer = setTimeout(() => closeHandler.current(current), 10000);
    return () => clearTimeout(timer);
  }, [current, draft, focused, sending]);
  if (!current) return null;
  const dismiss = () => {
    onClose(current);
    setCurrent(null);
    setDraft('');
    setError('');
    setFocused(false);
  };
  const reply = async (event) => {
    event.preventDefault();
    event.stopPropagation();
    const value = draft.trim(),
      source = current;
    if (!value || sending) return;
    setSending(true);
    setError('');
    try {
      await onReply(value, source);
      input.current?.blur();
      setDraft('');
      setFocused(false);
      onClose(source);
      setCurrent(null);
    } catch (error) {
      setError(error?.message || 'Could not send reply. Your draft is kept.');
    } finally {
      setSending(false);
    }
  };
  return (
    <section
      role="status"
      aria-live="polite"
      aria-label="Message notification"
      className="fixed right-3 top-3 sm:right-5 sm:top-5 z-[120] w-[370px] max-w-[calc(100vw-1.5rem)] rounded-2xl border border-white/10 bg-[#242529] text-white shadow-[0_18px_60px_rgba(0,0,0,.35)] p-4 animate-pop-in"
    >
      <div className="flex items-start gap-3">
        <Avatar name={current.from} src={current.avatar} size={42} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <strong className="text-sm truncate">{current.from}</strong>
            <span className="ml-auto text-[11px] text-white/60">{current.time || 'just now'}</span>
          </div>
          <p className="text-sm leading-snug text-slate-200 break-words line-clamp-3 mt-1">
            {current.preview}
          </p>
        </div>
        <button
          aria-label="Dismiss notification"
          className="p-1 rounded-lg hover:bg-white/10"
          onClick={dismiss}
        >
          <X size={16} />
        </button>
      </div>
      {current.canReply ? (
        <form className="flex gap-2 mt-3" onSubmit={reply}>
          <input
            ref={input}
            className="min-w-0 flex-1 bg-[#34363b] rounded-lg border border-white/20 px-3 py-2 text-sm outline-none focus:border-violet-400"
            value={draft}
            maxLength={4000}
            disabled={sending}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Type a reply…"
            aria-label="Quick reply"
          />
          <button
            type="submit"
            disabled={sending || !draft.trim()}
            aria-label="Send quick reply"
            className="px-3 rounded-lg bg-violet-600 disabled:opacity-50"
          >
            <Send size={17} />
          </button>
        </form>
      ) : (
        <button
          className="mt-3 text-sm flex gap-2 items-center text-violet-300 hover:underline"
          onClick={() => onOpen(current)}
        >
          <MessageSquareText size={15} /> Open chat
        </button>
      )}
      {error && (
        <p role="alert" className="text-red-300 text-xs mt-2">
          {error}
        </p>
      )}
    </section>
  );
}
