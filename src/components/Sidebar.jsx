import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Search,
  LogOut,
  Wifi,
  WifiOff,
  BellOff,
  Star,
  Plus,
  Users,
  Pin,
  CircleDot,
  Phone,
  Settings,
  ShieldCheck,
  MessagesSquare,
  PanelsTopLeft,
  Clock3,
  MoreHorizontal,
  CheckCheck,
  LockKeyhole,
  Palette,
  Link2,
  ListFilter,
  Layers,
  X,
  Archive,
} from 'lucide-react';
import Avatar from './Avatar';
import { shortPreview, formatTime } from '../lib/format';
import { roomId } from '../lib/socket';

export default function Sidebar({
  me,
  users,
  selected,
  onSelect,
  lastMessages,
  unread,
  connected,
  onLogout,
  preferences: p,
  onFeature,
  onBulk,
  lockEnabled,
}) {
  const [q, setQ] = useState(''),
    [tab, setTab] = useState('all'),
    [menuOpen, setMenuOpen] = useState(false),
    [selecting, setSelecting] = useState(false),
    [checked, setChecked] = useState([]);
  const menu = useRef();
  useEffect(() => {
    if (!menuOpen) return;
    const close = (e) => {
      if (!menu.current?.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [menuOpen]);
  const filtered = useMemo(
    () =>
      users
        .filter((u) => {
          const matches = `${u.name} ${u.phone} ${shortPreview(lastMessages[u.phone])}`
            .toLowerCase()
            .includes(q.trim().toLowerCase());
          if (!matches || (!q && p.hidden.includes(u.phone))) return false;
          const list = (p.lists || []).find((l) => l.id === tab);
          if (list) return list.chats.includes(u.phone);
          if (tab === 'archived') return p.archived.includes(u.phone);
          if (p.archived.includes(u.phone) && !q) return false;
          if (tab === 'unread') return unread[roomId(me.phone, u.phone)] > 0;
          if (tab === 'groups') return u.isGroup;
          if (tab === 'favorites') return p.favorites.includes(u.phone);
          return true;
        })
        .sort(
          (a, b) =>
            Number(p.pinned.includes(b.phone)) - Number(p.pinned.includes(a.phone)) ||
            new Date(lastMessages[b.phone]?.time || b.joinedAt || 0) -
              new Date(lastMessages[a.phone]?.time || a.joinedAt || 0)
        ),
    [users, q, tab, p, unread, me.phone, lastMessages]
  );
  const founder = users.find((u) => u.isFounder && u.phone !== me.phone),
    total = Object.values(unread).reduce((a, b) => a + b, 0);
  const actions = [
    ['group_create', 'New group', Users],
    ['starred', 'Starred messages', Star],
    ['select', 'Select chats', ListFilter],
    ['read', 'Mark all as read', CheckCheck],
    ['invite', 'Join via invite link', Link2],
    ['lists', 'Your chat lists', Layers],
    ['security', 'App lock', LockKeyhole],
    ['theme', 'Appearance', Palette],
    ['logout', 'Log out', LogOut],
  ];
  return (
    <aside className="inbox-shell">
      <nav className="app-rail" aria-label="Workspace navigation">
        <button className="pulse-mark" aria-label="PulseChat inbox" onClick={() => setTab('all')}>
          <span>p</span>
          <i />
        </button>
        <div className="rail-actions">
          <button
            className="rail-button active"
            title="Conversations"
            aria-label="Conversations"
            onClick={() => setTab('all')}
          >
            <MessagesSquare size={21} />
            {total > 0 && <i />}
          </button>
          {[
            ['board', PanelsTopLeft, 'Workspace board'],
            ['statuses', CircleDot, 'Status updates'],
            ['calls', Phone, 'Call history'],
            ['scheduled', Clock3, 'Scheduled messages'],
          ].map(([key, Icon, label]) => (
            <button
              key={key}
              title={label}
              aria-label={label}
              className="rail-button"
              onClick={() => onFeature(key)}
            >
              <Icon size={21} />
            </button>
          ))}
        </div>
        <div className="rail-bottom">
          <button
            className="rail-button"
            title="Appearance"
            aria-label="Appearance"
            onClick={() => onFeature('theme')}
          >
            <Palette size={21} />
          </button>
          <button
            className="rail-button"
            aria-label="App lock"
            title={lockEnabled ? 'Lock workspace' : 'Set app lock'}
            onClick={() => onFeature(lockEnabled ? 'lock_now' : 'security')}
          >
            <LockKeyhole size={20} />
          </button>
          <button onClick={() => onFeature('profile')} aria-label="Edit profile" title={me.name}>
            <Avatar name={me.name} size={36} online={connected} />
          </button>
        </div>
      </nav>
      <div className="inbox-list">
        <div className="inbox-brand">
          <div className="mobile-mark pulse-mark">
            <span>p</span>
            <i />
          </div>
          <div>
            <strong>
              PulseChat<span> / </span>
              <small>your everyday space</small>
            </strong>
            <p>
              {connected ? (
                <>
                  <Wifi size={10} />
                  <span>Connected</span>
                </>
              ) : (
                <>
                  <WifiOff size={10} />
                  <span>Reconnecting…</span>
                </>
              )}
            </p>
          </div>
          <button
            className="icon-btn"
            aria-label="Find anything"
            title="Find anything · Ctrl K"
            onClick={() => onFeature('command')}
          >
            <Search size={19} />
          </button>
        </div>
        <header className="inbox-heading">
          <div>
            <p className="eyebrow">A PLACE FOR YOUR PEOPLE</p>
            <h1>
              Conversations<span>{users.length}</span>
            </h1>
          </div>
          <button
            aria-label="New group"
            title="New group"
            className="new-chat-button"
            disabled={!connected}
            onClick={() => onFeature('group_create')}
          >
            <Plus size={21} />
          </button>
          <div ref={menu} className="relative">
            <button
              className="icon-btn"
              aria-label="Inbox menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <MoreHorizontal size={20} />
            </button>
            {menuOpen && (
              <div className="inbox-menu" role="menu" aria-label="Inbox actions">
                {actions.map(([key, label, Icon]) => (
                  <button
                    role="menuitem"
                    key={key}
                    onClick={() => {
                      setMenuOpen(false);
                      if (key === 'select') setSelecting(true);
                      else if (key === 'read') onBulk('read');
                      else if (key === 'logout') onLogout();
                      else onFeature(key);
                    }}
                  >
                    <Icon size={16} />
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </header>
        <div className="inbox-search">
          <Search size={17} />
          <input
            aria-label="Search chats"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search a name, group or recent message"
          />
          <kbd>/</kbd>
        </div>
        <div className="inbox-tabs scroll-thin">
          {[
            ['all', 'All'],
            ['unread', 'Unread'],
            ['groups', 'Groups'],
            ['favorites', 'Favourites'],
            ['archived', 'Archived'],
            ...(p.lists || []).map((l) => [l.id, l.name]),
          ].map(([key, label]) => (
            <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>
              {label}
              {key === 'unread' && total > 0 && <span>{total}</span>}
            </button>
          ))}
        </div>
        {selecting && (
          <div className="inbox-bulk">
            <span>{checked.length} selected</span>
            <button
              disabled={!checked.length}
              aria-label="Archive selected chats"
              title="Archive selected"
              onClick={() => {
                onBulk('archive', checked);
                setSelecting(false);
                setChecked([]);
              }}
            >
              <Archive size={16} />
            </button>
            <button
              disabled={!checked.length}
              aria-label="Read selected chats"
              onClick={() => {
                onBulk('read', checked);
                setSelecting(false);
                setChecked([]);
              }}
            >
              <CheckCheck size={16} />
            </button>
            <button
              aria-label="Cancel chat selection"
              onClick={() => {
                setSelecting(false);
                setChecked([]);
              }}
            >
              <X size={16} />
            </button>
          </div>
        )}
        {founder && tab === 'all' && !q && (
          <button className="founder-card" onClick={() => onSelect(founder)}>
            <ShieldCheck size={19} />
            <span>
              Talk to the founder<small>A question, a thought, a bright idea.</small>
            </span>
          </button>
        )}
        <div className="chat-list scroll-thin">
          {filtered.length === 0 && (
            <div className="empty-inbox">
              <MessagesSquare size={30} />
              <h3>{q ? 'No conversations found' : 'A little quiet, for now.'}</h3>
              <p>
                {q
                  ? 'Try another name or phrase.'
                  : 'Start a conversation, create a group or save a note to yourself.'}
              </p>
              <button className="card-link" onClick={() => onFeature('invite')}>
                Join a group <Link2 size={13} />
              </button>
            </div>
          )}
          {filtered.map((u) => {
            const last = lastMessages[u.phone],
              count = unread[roomId(me.phone, u.phone)] || 0;
            return (
              <div key={u.phone} className="flex items-center gap-1">
                {selecting && (
                  <input
                    aria-label={`Select chat ${u.name}`}
                    type="checkbox"
                    checked={checked.includes(u.phone)}
                    onChange={(e) =>
                      setChecked(
                        e.target.checked
                          ? [...checked, u.phone]
                          : checked.filter((p) => p !== u.phone)
                      )
                    }
                  />
                )}
                <button
                  onClick={() => onSelect(u)}
                  className={`chat-list-item ${selected?.phone === u.phone ? 'active' : ''}`}
                >
                  <div className="relative">
                    <Avatar name={u.name} size={45} online={!u.isGroup && !u.isSelf && u.online} />
                    {u.isGroup && (
                      <span className="group-avatar-badge">
                        <Users size={11} />
                      </span>
                    )}
                  </div>
                  <div className="chat-list-copy">
                    <div>
                      <strong>{u.name}</strong>
                      {p.pinned.includes(u.phone) && <Pin size={11} />}
                      {p.favorites.includes(u.phone) && <Star size={11} />}
                      {p.muted.includes(u.phone) && <BellOff size={11} />}
                      <time>{last ? formatTime(last.time) : ''}</time>
                    </div>
                    <p>
                      <span>
                        {p.blocked.includes(u.phone)
                          ? 'Blocked contact'
                          : shortPreview(last) ||
                            (u.isGroup
                              ? `${u.members.length} people · One shared space`
                              : u.isSelf
                                ? 'Your thoughts, safely in one place'
                                : u.online
                                  ? 'Around for a conversation'
                                  : u.about || 'Offline')}
                      </span>
                      {count > 0 && <b>{count > 99 ? '99+' : count}</b>}
                    </p>
                  </div>
                </button>
              </div>
            );
          })}
        </div>
        <footer className="inbox-footer">
          <button className="profile-summary" onClick={() => onFeature('profile')}>
            <Avatar name={me.name} size={31} />
            <span>
              {me.name}
              <small>Your personal space</small>
            </span>
          </button>
          <div className="mobile-tools">
            <button
              aria-label="Workspace board"
              title="Workspace board"
              className="icon-btn"
              onClick={() => onFeature('board')}
            >
              <PanelsTopLeft size={18} />
            </button>
            <button
              aria-label="Status updates"
              title="Status updates"
              className="icon-btn"
              onClick={() => onFeature('statuses')}
            >
              <CircleDot size={18} />
            </button>
            <button
              aria-label="Call history"
              title="Call history"
              className="icon-btn"
              onClick={() => onFeature('calls')}
            >
              <Phone size={18} />
            </button>
          </div>
          <button
            aria-label="Log out"
            title="Log out"
            className="icon-btn logout-shortcut"
            onClick={onLogout}
          >
            <LogOut size={16} />
          </button>
        </footer>
      </div>
    </aside>
  );
}
