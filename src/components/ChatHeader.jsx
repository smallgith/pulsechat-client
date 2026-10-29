import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Phone,
  Video,
  Search,
  MoreVertical,
  User,
  CheckSquare,
  BellOff,
  Timer,
  Heart,
  XCircle,
  Link2,
  Eraser,
  Trash2,
  Pin,
  Archive,
  Ban,
  Download,
  Image,
  Star,
  PanelsTopLeft,
  Layers,
  Flag,
} from 'lucide-react';
import Avatar from './Avatar';

export default function ChatHeader({
  user,
  me,
  typing,
  muted,
  favorite,
  preferences: p,
  onBack,
  onVoiceCall,
  onVideoCall,
  onOpenSearch,
  onAction,
  connected,
}) {
  const [open, setOpen] = useState(false),
    menuRef = useRef(null);
  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (!menuRef.current?.contains(e.target)) setOpen(false);
    };
    const escape = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);
  const id = user.phone;
  const items = [
    ['contact', user.isGroup ? 'Group info' : 'Contact info', User],
    ['search', 'Search messages', Search],
    ['select', 'Select messages', CheckSquare],
    ['board', 'Conversation workspace', PanelsTopLeft],
    ['lists', 'Add to a list', Layers],
    ['media', 'Shared media & files', Image],
    ['starred', 'Starred messages', Star],
    ['mute', muted ? 'Unmute notifications' : 'Mute notifications', BellOff],
    ['favorite', favorite ? 'Remove from favourites' : 'Add to favourites', Heart],
    ['pin', p.pinned.includes(id) ? 'Unpin chat' : 'Pin chat', Pin],
    ['archive', p.archived.includes(id) ? 'Unarchive chat' : 'Archive chat', Archive],
    ['disappearing', 'Disappearing messages', Timer],
    ['share', 'Copy chat link', Link2],
    ['export', 'Export chat', Download],
    ...(!user.isGroup && id !== me
      ? [['block', p.blocked.includes(id) ? 'Unblock contact' : 'Block contact', Ban]]
      : []),
    ['clear', 'Clear chat', Eraser],
    ['delete', 'Delete chat', Trash2],
    ['close', 'Close chat', XCircle],
    ['report', 'Report conversation', Flag],
  ];
  const canCall = !user.isGroup && id !== me;
  return (
    <header className="conversation-header flex items-center gap-2 sm:gap-3 px-2 sm:px-5 py-3 sm:py-4 glass-solid border-b border-white/10 z-30 relative shrink-0 safe-top">
      <button onClick={onBack} className="md:hidden icon-btn" aria-label="Back">
        <ArrowLeft size={20} />
      </button>
      <button onClick={() => onAction('contact')} aria-label="Contact info">
        <Avatar name={user.name} size={42} online={!user.isGroup && user.online} />
      </button>
      <button onClick={() => onAction('contact')} className="min-w-0 flex-1 text-left">
        <h3 className="font-semibold truncate text-[15px] sm:text-base">
          {id === me ? 'Message yourself' : user.name}
        </h3>
        <p
          className={`text-[11px] truncate ${typing || user.online ? 'text-brand-400' : 'text-slate-400'}`}
        >
          {typing
            ? `${typing} is typing…`
            : user.isGroup
              ? `${user.members.length} members`
              : id === me
                ? 'Your private notes'
                : user.online
                  ? 'online'
                  : user.lastSeen
                    ? `last seen ${new Date(user.lastSeen).toLocaleString()}`
                    : 'offline'}
        </p>
      </button>
      <div className="flex items-center gap-0.5 shrink-0">
        {canCall && (
          <>
            <button
              onClick={onVoiceCall}
              disabled={!connected || !user.online || p.blocked.includes(id)}
              className="icon-btn"
              aria-label="Voice call"
              title="Voice call"
            >
              <Phone size={18} />
            </button>
            <button
              onClick={onVideoCall}
              disabled={!connected || !user.online || p.blocked.includes(id)}
              className="icon-btn"
              aria-label="Video call"
              title="Video call"
            >
              <Video size={18} />
            </button>
          </>
        )}
        <button onClick={onOpenSearch} className="icon-btn" aria-label="Search messages">
          <Search size={18} />
        </button>
        <div className="relative" ref={menuRef}>
          <button
            className="icon-btn"
            onClick={() => setOpen(!open)}
            aria-label="Chat menu"
            aria-expanded={open}
          >
            <MoreVertical size={18} />
          </button>
          {open && (
            <div
              role="menu"
              aria-label="Chat actions"
              className="absolute top-full right-0 mt-1 w-64 py-1.5 glass-solid rounded-2xl shadow-2xl border border-white/15 z-50 max-h-[75dvh] overflow-y-auto scroll-thin"
            >
              {items.map(([key, label, Icon]) => (
                <button
                  role="menuitem"
                  key={key}
                  className={`w-full flex gap-3 items-center px-4 py-2.5 text-sm text-left hover:bg-white/5 ${['block', 'delete', 'clear'].includes(key) ? 'text-red-400' : 'text-slate-200'}`}
                  onClick={() => {
                    setOpen(false);
                    onAction(key);
                  }}
                >
                  <Icon size={16} />
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
