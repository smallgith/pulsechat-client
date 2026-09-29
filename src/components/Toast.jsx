import { useEffect } from 'react';
import { MessageCircle, X } from 'lucide-react';
import Avatar from './Avatar';

export default function Toast({ toast, onClose, onOpen, onReply }) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onClose, 5000);
    return () => clearTimeout(t);
  }, [toast, onClose]);

  if (!toast) return null;

  return (
    <div
      onClick={onOpen}
      className="fixed top-4 right-4 z-[100] w-[340px] max-w-[calc(100vw-2rem)]
                 glass rounded-2xl shadow-2xl border border-white/10 p-3
                 cursor-pointer animate-pop-in hover:border-brand-500/40
                 transition group"
    >
      <div className="flex items-start gap-3">
        <Avatar name={toast.from} size={42} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-sm truncate">{toast.from}</p>
            <span className="ml-auto text-[10px] text-slate-500">
              {toast.time || 'now'}
            </span>
          </div>
          <p className="text-xs text-slate-300 line-clamp-2 mt-0.5">
            {toast.preview}
          </p>

          {toast.canReply && (
            <div className="mt-2 flex gap-2">
              <input
                placeholder="Quick reply…"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                    onReply?.(e.currentTarget.value.trim());
                    e.currentTarget.value = '';
                    onClose();
                  }
                }}
                className="flex-1 text-xs px-2.5 py-1.5 rounded-lg bg-ink-900/70
                           border border-white/10 outline-none
                           focus:border-brand-500/40"
              />
            </div>
          )}
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="p-1 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-b-2xl overflow-hidden bg-white/5">
        <div className="h-full bg-gradient-to-r from-brand-400 to-emerald-500 animate-[shrink_5s_linear_forwards]" />
      </div>

      <style>{`
        @keyframes shrink {
          from { width: 100%; }
          to   { width: 0%; }
        }
      `}</style>
    </div>
  );
}