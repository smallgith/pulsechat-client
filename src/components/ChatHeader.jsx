import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft, Phone, Video, Search, MoreVertical,
  User, CheckSquare, BellOff, Timer, Heart,
  ListPlus, XCircle, Link2, Calendar, Users, Flag,
  Ban, Eraser, Trash2, ChevronRight,
} from 'lucide-react';
import Avatar from './Avatar';

const MENU_ITEMS = [
  { key: 'contact', label: 'Contact info', icon: User },
  { key: 'search', label: 'Search', icon: Search },
  { key: 'select', label: 'Select messages', icon: CheckSquare },
  { key: 'mute', label: 'Mute notifications', icon: BellOff, sub: true },
  { key: 'disappearing', label: 'Disappearing messages', icon: Timer },
  { key: 'favorite', label: 'Add to favourites', icon: Heart },
  { key: 'list', label: 'Add to list', icon: ListPlus, sub: true },
  { key: 'close', label: 'Close chat', icon: XCircle },
  { divider: true },
  { key: 'call_link', label: 'Send call link', icon: Link2 },
  { key: 'schedule', label: 'Schedule call', icon: Calendar },
  { key: 'group_call', label: 'New group call', icon: Users },
  { divider: true },
  { key: 'report', label: 'Report', icon: Flag },
  { key: 'block', label: 'Block', icon: Ban, danger: true },
  { key: 'clear', label: 'Clear chat', icon: Eraser, danger: true },
  { key: 'delete', label: 'Delete chat', icon: Trash2, danger: true },
];

export default function ChatHeader({
  user, typing, muted, favorite,
  onBack, onVoiceCall, onVideoCall,
  onOpenSearch, onAction, onCloseChat,
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (!menuRef.current?.contains(e.target)) setOpen(false);
    };
    const onEsc = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('touchstart', onDoc);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('touchstart', onDoc);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  return (
    <header className="flex items-center gap-2 sm:gap-3 px-2 sm:px-5 py-2 sm:py-3 glass-solid border-b border-white/10 z-30 relative shrink-0 safe-top">
      <button
        onClick={onBack}
        className="md:hidden p-2 -ml-1 rounded-xl text-slate-300 hover:bg-white/5 active:bg-white/10 transition shrink-0"
        aria-label="Back"
      >
        <ArrowLeft className="w-5 h-5" />
      </button>

      <Avatar name={user.name || user.phone} size={40} online />

      <div className="min-w-0 flex-1">
        <h3 className="font-semibold truncate leading-tight text-[15px] sm:text-base">
          {user.name || user.phone}
        </h3>
        <p className="text-[11px] text-brand-400 truncate">
          {typing ? 'typing…' : 'online'}
        </p>
      </div>

      <div className="flex items-center gap-0.5 shrink-0">
        <button
          onClick={onVoiceCall}
          className="p-2 sm:p-2.5 rounded-xl text-slate-400 hover:text-brand-400 hover:bg-white/5 active:bg-white/10 transition"
          aria-label="Voice call"
        >
          <Phone className="w-[18px] h-[18px]" />
        </button>

        <button
          onClick={onVideoCall}
          className="p-2 sm:p-2.5 rounded-xl text-slate-400 hover:text-brand-400 hover:bg-white/5 active:bg-white/10 transition"
          aria-label="Video call"
        >
          <Video className="w-[18px] h-[18px]" />
        </button>

        <button
          onClick={onOpenSearch}
          className="p-2 sm:p-2.5 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-white/5 active:bg-white/10 transition hidden sm:block"
          aria-label="Search"
        >
          <Search className="w-[18px] h-[18px]" />
        </button>

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setOpen((s) => !s)}
            className={`p-2 sm:p-2.5 rounded-xl transition ${
              open
                ? 'text-brand-400 bg-brand-500/10'
                : 'text-slate-400 hover:text-slate-100 hover:bg-white/5 active:bg-white/10'
            }`}
            aria-label="Menu"
          >
            <MoreVertical className="w-[18px] h-[18px]" />
          </button>

          {open && (
            <>
              {/* backdrop for mobile */}
              <div
                className="fixed inset-0 z-40 sm:hidden"
                onClick={() => setOpen(false)}
              />

              <div className="absolute top-full right-0 mt-1 w-64 sm:w-72 py-1.5 glass-solid rounded-2xl shadow-2xl border border-white/15 z-50 animate-pop-in max-h-[80vh] overflow-y-auto scroll-thin">
                {MENU_ITEMS.map((it, i) =>
                  it.divider ? (
                    <div key={i} className="h-px my-1.5 bg-white/10" />
                  ) : (
                    <button
                      key={it.key}
                      onClick={() => {
                        setOpen(false);
                        onAction?.(it.key);
                      }}
                      className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-sm text-left transition ${
                        it.danger
                          ? 'text-red-400 hover:bg-red-500/10 active:bg-red-500/15'
                          : 'text-slate-200 hover:bg-white/5 active:bg-white/10'
                      }`}
                    >
                      <it.icon className="w-4 h-4 shrink-0" />
                      <span className="flex-1">{it.label}</span>

                      {it.key === 'mute' && muted && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand-500/20 text-brand-400">
                          ON
                        </span>
                      )}
                      {it.key === 'favorite' && favorite && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400">
                          ★
                        </span>
                      )}
                      {it.sub &&
                        !(it.key === 'mute' && muted) &&
                        !(it.key === 'favorite' && favorite) && (
                          <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                        )}
                    </button>
                  )
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}