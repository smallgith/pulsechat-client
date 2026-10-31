import { useEffect, useMemo, useRef, useState } from 'react';
import {
  MessagesSquare,
  Search,
  X,
  ChevronUp,
  ChevronDown,
  UploadCloud,
  ArrowUpRight,
  ListTodo,
  Clock3,
  Lightbulb,
  Sparkles,
} from 'lucide-react';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';
import ChatHeader from './ChatHeader';
import ConfirmDialog from './ConfirmDialog';
import { groupByDay } from '../lib/format';
import { groupMedia } from '../lib/media-clusters';
import MediaGallery from './MediaGallery';
import { wallpaperKey, getWallpaper } from '../lib/wallpapers';

function TypingIndicator({ name }) {
  return (
    <div className="flex items-center gap-2 mb-2 animate-fade-up">
      <div className="flex items-center gap-1.5 px-4 py-3 rounded-2xl rounded-bl-md bg-ink-600/90 border border-white/5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-slate-300 animate-bounceDot"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
      <span className="text-[11px] text-slate-500">{name} is typing…</span>
    </div>
  );
}

function EmptyState({ onFeature }) {
  return (
    <div className="workspace-welcome flex-1 hidden md:flex">
      <div className="welcome-orbit">
        <MessagesSquare size={42} strokeWidth={1.3} />
        <span>✦</span>
      </div>
      <p className="eyebrow">A LITTLE SPACE FOR BIG IDEAS</p>
      <h2>
        Good conversations.
        <br />
        <em>Great things next.</em>
      </h2>
      <p className="welcome-copy">
        Bring your people, plans and files together.
        <br />A calmer place to talk. A smarter place to get things done.
      </p>
      <div className="welcome-actions">
        {[
          ['board', ListTodo, 'A place for your plans', 'Tasks & decisions'],
          ['scheduled', Clock3, 'One less thing to remember', 'Your outbox'],
          ['command', Sparkles, 'Find it. Keep moving.', 'Search everything'],
        ].map(([key, Icon, title, label]) => (
          <button key={key} onClick={() => onFeature(key)}>
            <Icon size={23} />
            <strong>{title}</strong>
            <span>
              {label}
              <ArrowUpRight size={15} />
            </span>
          </button>
        ))}
      </div>
      <p className="welcome-shortcut">
        <kbd>Ctrl</kbd>
        <span>+</span>
        <kbd>K</kbd> Your shortcut to everything
      </p>
    </div>
  );
}

export default function ChatWindow({
  me,
  user,
  messages,
  people,
  typing,
  muted,
  favorite,
  onSend,
  onTyping,
  onBack,
  onVoiceCall,
  onVideoCall,
  onDeleteMessage,
  onReactMessage,
  onAction,
  onEditMessage,
  onForwardMessage,
  onForwardMany,
  onStarMessage,
  preferences,
  connected,
  onCompose,
  onFeature,
  onCardAction,
  onOpenContact,
  onTask,
  onDecision,
  scheduledDraft,
}) {
  const bottomRef = useRef(null);
  const [galleryId, setGalleryId] = useState(null);
  const [wallpaper, setWallpaper] = useState('');
  useEffect(() => {
    const key = wallpaperKey(me, user?.phone);
    let cancelled = false;
    let url = '';
    const load = async () => {
      try {
        const file = await getWallpaper(key);
        if (cancelled) return;
        url = file ? URL.createObjectURL(file) : '';
        setWallpaper(url);
      } catch { if (!cancelled) setWallpaper(''); }
    };
    load();
    const changed = e => { if (e.detail === key) { if (url) URL.revokeObjectURL(url); url = ''; load(); } };
    window.addEventListener('pulsechat:wallpaper', changed);
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); window.removeEventListener('pulsechat:wallpaper', changed); };
  }, [me, user?.phone]);
  const mediaItems = useMemo(() => messages.filter(m => !m.deleted && (m.file?.mime?.startsWith('image/') || m.file?.mime?.startsWith('video/') || m.gif)), [messages]);
  useEffect(() => {
    const open = () => {
      const first = mediaItems.find(m => m.file?.mime?.startsWith('image/') || m.gif) || mediaItems[0];
      if (first) setGalleryId(first.id);
    };
    window.addEventListener('pulsechat:open-gallery', open);
    return () => window.removeEventListener('pulsechat:open-gallery', open);
  }, [mediaItems]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [searchIdx, setSearchIdx] = useState(0);
  const [replyTo, setReplyTo] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  useEffect(() => {
    const search = () => setSearchOpen(true);
    window.addEventListener('pulsechat:search-chat', search);
    return () => window.removeEventListener('pulsechat:search-chat', search);
  }, []);
  const composer = useRef(),
    dragDepth = useRef(0);
  const [dragging, setDragging] = useState(false);
  useEffect(() => {
    if (!user?.phone || !window.matchMedia('(min-width: 768px)').matches) return;
    const timer = setTimeout(() => composer.current?.focus(), 70);
    return () => clearTimeout(timer);
  }, [user?.phone]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, typing]);

  const groups = useMemo(() => groupByDay(messages), [messages]);
  const mediaClusters = useMemo(() => Object.fromEntries(groups.map(g => [g.label, groupMedia(g.items)])), [groups]);

  const filteredIds = useMemo(() => {
    if (!searchQ.trim()) return [];
    const q = searchQ.toLowerCase();
    return messages.filter((m) => (m.text || '').toLowerCase().includes(q)).map((m) => m.id);
  }, [searchQ, messages]);

  const scrollToMessage = (id) => {
    document.getElementById(`msg-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  useEffect(() => {
    if (filteredIds[searchIdx]) scrollToMessage(filteredIds[searchIdx]);
  }, [searchIdx, searchQ]);

  const nextMatch = () => {
    if (!filteredIds.length) return;
    const i = (searchIdx + 1) % filteredIds.length;
    setSearchIdx(i);
    scrollToMessage(filteredIds[i]);
  };
  const prevMatch = () => {
    if (!filteredIds.length) return;
    const i = (searchIdx - 1 + filteredIds.length) % filteredIds.length;
    setSearchIdx(i);
    scrollToMessage(filteredIds[i]);
  };

  const askDelete = (msg, forEveryone) => {
    setConfirm({ msg, forEveryone });
  };

  const doDelete = () => {
    if (!confirm) return;
    onDeleteMessage?.(confirm.msg, confirm.forEveryone);
    setConfirm(null);
  };

  if (!user) return <EmptyState onFeature={onFeature} />;
  const adminOnly = user.isGroup && user.settings?.adminsOnly && !user.admins.includes(me);

  return (
    <section
      className="chat-panel flex-1 flex flex-col min-w-0 chat-bg h-full relative"
      style={wallpaper ? { backgroundImage: `linear-gradient(transparent, rgba(0,0,0,.06)), url("${wallpaper}")`, backgroundPosition: "center", backgroundSize: "cover", backgroundRepeat: "no-repeat" } : {}}
      onDragEnter={(e) => {
        if (e.dataTransfer.types.includes('Files')) {
          e.preventDefault();
          dragDepth.current++;
          setDragging(true);
        }
      }}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('Files')) e.preventDefault();
      }}
      onDragLeave={(e) => {
        if (e.dataTransfer.types.includes('Files')) {
          e.preventDefault();
          if (--dragDepth.current <= 0) setDragging(false);
        }
      }}
      onDrop={(e) => {
        if (!e.dataTransfer.files.length) return;
        e.preventDefault();
        dragDepth.current = 0;
        setDragging(false);
        composer.current?.addFiles(e.dataTransfer.files);
      }}
    >
      {dragging && (
        <div className="chat-dropzone">
          <UploadCloud size={52} />
          <h3>Room for every big idea.</h3>
          <p>Drop multiple files anywhere in this conversation.</p>
          <span>Up to 2 GB per file · resumable transfers</span>
        </div>
      )}
      <ChatHeader
        me={me}
        user={user}
        connected={connected}
        preferences={preferences}
        typing={typing}
        muted={muted}
        favorite={favorite}
        onBack={onBack}
        onVoiceCall={onVoiceCall}
        onVideoCall={onVideoCall}
        onOpenSearch={() => setSearchOpen((s) => !s)}
        onCloseChat={onBack}
        onAction={(key) => {
          if (key === 'search') {
            setSearchOpen(true);
            return;
          }
          if (key === 'close') {
            onBack?.();
            return;
          }
          if (key === 'select') {
            setSelecting(true);
            return;
          }
          onAction?.(key);
        }}
      />

      <div className="conversation-context">
        <span>
          <span className="context-dot" />
          {messages.length} messages · one shared space
        </span>
        <div>
          <button
            onClick={() => onAction('focus')}
            aria-pressed={preferences.focusUntil > Date.now()}
            className={preferences.focusUntil > Date.now() ? 'active' : ''}
          >
            <Sparkles size={12} />
            {preferences.focusUntil > Date.now() ? 'Focus on · 30m' : 'Focus mode'}
          </button>
          <button onClick={() => onAction('board')}>
            <ListTodo size={13} />
            Workspace
            {messages.filter((m) => m.task && m.task.state !== 'done' && !m.deleted).length > 0 && (
              <b>
                {messages.filter((m) => m.task && m.task.state !== 'done' && !m.deleted).length}
              </b>
            )}
            <ArrowUpRight size={12} />
          </button>
        </div>
      </div>

      {selecting && (
        <div className="flex flex-wrap items-center gap-2 px-4 py-2 bg-ink-800 border-b border-white/10 text-xs">
          <span className="flex-1">{selectedIds.length} selected</span>
          <button
            className="btn-secondary !text-xs"
            onClick={() => setSelectedIds(messages.filter((m) => !m.deleted).map((m) => m.id))}
          >
            Select all
          </button>
          <button
            disabled={!selectedIds.length}
            className="btn-secondary !text-xs"
            onClick={() => {
              onForwardMany(messages.filter((m) => selectedIds.includes(m.id)));
              setSelecting(false);
              setSelectedIds([]);
            }}
          >
            Forward
          </button>
          <button
            disabled={!selectedIds.length}
            className="btn-secondary !text-xs text-red-400"
            onClick={() => setConfirm({ many: true })}
          >
            Delete for me
          </button>
          <button
            className="icon-btn"
            aria-label="Cancel selection"
            onClick={() => {
              setSelecting(false);
              setSelectedIds([]);
            }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {searchOpen && (
        <div className="px-2 sm:px-5 py-2 glass-solid border-b border-white/10 flex items-center gap-2 animate-pop-in shrink-0">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            autoFocus
            value={searchQ}
            onChange={(e) => {
              setSearchQ(e.target.value);
              setSearchIdx(0);
            }}
            placeholder="Search in messages…"
            className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-ink-900/80 border border-white/10 text-sm outline-none focus:border-brand-500/40"
          />
          {searchQ && (
            <span className="text-xs text-slate-400 shrink-0">
              {filteredIds.length ? `${searchIdx + 1}/${filteredIds.length}` : '0'}
            </span>
          )}
          <button
            onClick={prevMatch}
            disabled={!filteredIds.length}
            className="p-1.5 rounded-lg hover:bg-white/5 disabled:opacity-40 shrink-0"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
          <button
            onClick={nextMatch}
            disabled={!filteredIds.length}
            className="p-1.5 rounded-lg hover:bg-white/5 disabled:opacity-40 shrink-0"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setSearchOpen(false);
              setSearchQ('');
            }}
            aria-label="Close message search"
            className="p-1.5 rounded-lg hover:bg-white/5 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto scroll-thin px-2 sm:px-4 md:px-5 py-2 sm:py-3">
        <div className="max-w-5xl mx-auto">
          {groups.map((g) => (
            <div key={g.label}>
              <div className="flex justify-center my-2 sm:my-3">
                <span className="px-3.5 py-1 rounded-full text-[11px] font-medium text-slate-400 bg-white/[0.06] border border-white/5">
                  {g.label}
                </span>
              </div>
              {g.items.map((m) => {
                const clustered = mediaClusters[g.label];
                if (clustered.hidden.has(m.id)) return null;
                const isHighlighted = filteredIds[searchIdx] === m.id;
                return (
                  <div
                    key={m.id}
                    id={`msg-${m.id}`}
                    className={
                      isHighlighted ? 'ring-2 ring-brand-500/60 rounded-2xl transition' : ''
                    }
                  >
                    {selecting && !m.deleted && (
                      <label className="flex items-center gap-2 text-[11px] text-slate-400 py-1 cursor-pointer">
                        <input
                          aria-label={`Select message ${m.text || 'attachment'}`}
                          type="checkbox"
                          checked={selectedIds.includes(m.id)}
                          onChange={(e) =>
                            setSelectedIds((prev) =>
                              e.target.checked ? [...prev, m.id] : prev.filter((id) => id !== m.id)
                            )
                          }
                        />
                        Select message
                      </label>
                    )}
                    <MessageBubble
                      message={m}
                      cluster={clustered.starts.get(m.id)}
                      onOpenMedia={setGalleryId}
                      people={people}
                      me={me}
                      onCardAction={onCardAction}
                      onOpenContact={onOpenContact}
                      onTask={onTask}
                      onDecision={onDecision}
                      mine={m.from === me}
                      onDelete={askDelete}
                      onReply={(msg) => { setReplyTo(msg); requestAnimationFrame(() => composer.current?.focus()); }}
                      onReact={(msg, emoji) => onReactMessage?.(msg, emoji)}
                      showName={user.isGroup && m.from !== me}
                      starred={preferences.starred.includes(m.id)}
                      onStar={onStarMessage}
                      onEdit={onEditMessage}
                      onForward={onForwardMessage}
                    />
                  </div>
                );
              })}
            </div>
          ))}

          {!messages.length && (
            <p className="text-xs text-center text-slate-500 py-8">
              {user.phone === me
                ? 'Send yourself notes, links, files and voice reminders.'
                : 'Start the conversation. Send a message below.'}
            </p>
          )}
          {typing && <TypingIndicator name={typing} />}
          <div ref={bottomRef} />
        </div>
      </div>

      {!connected && (
        <p className="px-4 py-2 text-xs text-amber-300 bg-amber-500/10">
          Reconnecting… Your draft is saved on this device.
        </p>
      )}
      {preferences.blocked.includes(user.phone) && (
        <p className="px-4 py-2 text-xs text-red-300 bg-red-500/10">
          This contact is blocked. Use the chat menu to unblock.
        </p>
      )}
      {adminOnly && (
        <p className="px-4 py-2 text-xs text-slate-400 bg-white/5">
          Only group admins can send messages.
        </p>
      )}
      <MessageInput
        ref={composer}
        key={user.phone}
        draftKey={`pulsechat.draft.${me}.${user.phone}`}
        disabled={!connected || preferences.blocked.includes(user.phone) || adminOnly}
        onCompose={onCompose}
        scheduledDraft={scheduledDraft}
        onSend={onSend}
        onTyping={onTyping}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
      />

      {galleryId && <MediaGallery items={mediaItems} initialId={galleryId} onClose={() => setGalleryId(null)} />}
      <ConfirmDialog
        open={!!confirm}
        title={
          confirm?.many
            ? `Delete ${selectedIds.length} messages for me?`
            : confirm?.forEveryone
              ? 'Delete for everyone?'
              : 'Delete for me?'
        }
        message={
          confirm?.forEveryone
            ? 'This message will be deleted for everyone in this chat.'
            : 'This message will be removed from your device only.'
        }
        confirmLabel="Delete"
        danger
        onCancel={() => setConfirm(null)}
        onConfirm={async () => {
          if (confirm?.many) {
            for (const m of messages.filter((m) => selectedIds.includes(m.id)))
              await onDeleteMessage(m, false);
            setSelectedIds([]);
            setSelecting(false);
            setConfirm(null);
          } else doDelete();
        }}
      />
    </section>
  );
} 