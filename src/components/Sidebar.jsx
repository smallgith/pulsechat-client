import { useMemo, useState } from 'react';
import { Search, LogOut, Wifi, WifiOff, BellOff, Star } from 'lucide-react';
import Avatar from './Avatar';
import { shortPreview, formatTime } from '../lib/format';

export default function Sidebar({
  me, users, selected, onSelect, lastMessages,
  unread, connected, onLogout, muted, favorites,
}) {
  const [q, setQ] = useState('');
  const [tab, setTab] = useState('all');

  const filtered = useMemo(() => {
    let list = users.filter(
      (u) =>
        u.name?.toLowerCase().includes(q.trim().toLowerCase()) ||
        u.phone?.includes(q.trim())
    );
    if (tab === 'unread') list = list.filter((u) => unread[[me, u.phone].sort().join('::')]);
    if (tab === 'favorites') list = list.filter((u) => favorites?.has(u.phone));
    return list.sort((a, b) => {
      const ta = lastMessages[a.phone]?.time || a.joinedAt;
      const tb = lastMessages[b.phone]?.time || b.joinedAt;
      return new Date(tb) - new Date(ta);
    });
  }, [users, q, lastMessages, tab, unread, favorites, me]);

  return (
    <aside className="w-full md:w-[360px] lg:w-[400px] shrink-0 flex flex-col glass border-r border-white/5">
      <header className="flex items-center gap-3 px-4 py-4 border-b border-white/5">
        <Avatar name={me} size={44} online={connected} />
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold truncate leading-tight">{me}</h2>
          <p className="flex items-center gap-1.5 text-[11px] text-slate-400">
            {connected ? <><Wifi className="w-3 h-3 text-brand-400" /> Online</> : <><WifiOff className="w-3 h-3 text-red-400" /> Connecting…</>}
          </p>
        </div>
        <button
          onClick={onLogout}
          title="Log out"
          className="p-2.5 rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition"
        >
          <LogOut size={18} />
        </button>
      </header>

      <div className="px-4 py-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search people…"
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-ink-900/60 border border-white/5 text-sm placeholder-slate-500 outline-none transition focus:border-brand-500/40 focus:ring-4 focus:ring-brand-500/10"
          />
        </div>

        <div className="flex gap-1 mt-3">
          {[
            { key: 'all', label: 'All' },
            { key: 'unread', label: 'Unread' },
            { key: 'favorites', label: '★ Favourites' },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                tab === t.key
                  ? 'bg-brand-500/20 text-brand-400'
                  : 'text-slate-400 hover:bg-white/5'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scroll-thin px-2 pb-3">
        <p className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          {tab === 'all' ? `Online — ${filtered.length}` : tab === 'unread' ? `Unread — ${filtered.length}` : `Favourites — ${filtered.length}`}
        </p>

        {filtered.length === 0 && (
          <div className="px-4 py-10 text-center text-sm text-slate-500">
            No one here yet.
          </div>
        )}

        {filtered.map((u) => {
          const rid = [me, u.phone].sort().join('::');
          const last = lastMessages[u.phone];
          const count = unread[rid] || 0;
          const active = selected?.phone === u.phone;
          const isMuted = muted?.has(u.phone);
          const isFav = favorites?.has(u.phone);

          return (
            <button
              key={u.phone}
              onClick={() => onSelect(u)}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-2xl text-left transition-all duration-150 ${
                active
                  ? 'bg-gradient-to-r from-brand-500/20 to-transparent border border-brand-500/25'
                  : 'border border-transparent hover:bg-white/[0.04]'
              }`}
            >
              <Avatar name={u.name || u.phone} size={48} online />

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-medium truncate text-[15px]">
                      {u.name || u.phone}
                    </span>
                    {isFav && <Star className="w-3 h-3 text-yellow-400 fill-yellow-400 shrink-0" />}
                    {isMuted && <BellOff className="w-3 h-3 text-slate-500 shrink-0" />}
                  </div>
                  {last && (
                    <span className="text-[10px] text-slate-500 shrink-0">
                      {formatTime(last.time)}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2 mt-0.5">
                  <span className="text-xs text-slate-400 truncate">
                    {shortPreview(last) || 'Say hi 👋'}
                  </span>
                  {count > 0 && (
                    <span className="shrink-0 min-w-[20px] h-5 px-1.5 rounded-full bg-brand-500 text-[11px] font-bold text-ink-900 flex items-center justify-center">
                      {count > 99 ? '99+' : count}
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}