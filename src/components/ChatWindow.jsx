import { useEffect, useMemo, useRef, useState } from 'react';
import { MessagesSquare, Search, X, ChevronUp, ChevronDown } from 'lucide-react';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';
import ChatHeader from './ChatHeader';
import ConfirmDialog from './ConfirmDialog';
import { groupByDay } from '../lib/format';

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

function EmptyState() {
  return (
    <div className="flex-1 hidden md:flex flex-col items-center justify-center chat-bg px-8 text-center">
      <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-brand-500/20 to-indigo-500/20 border border-white/10 flex items-center justify-center mb-6">
        <MessagesSquare className="w-11 h-11 text-brand-400" strokeWidth={1.5} />
      </div>
      <h3 className="text-xl font-semibold mb-2">Welcome to PulseChat</h3>
      <p className="text-sm text-slate-400 max-w-sm leading-relaxed">
        Select a person from the list to start chatting.
      </p>
    </div>
  );
}

export default function ChatWindow({
  me, user, messages, typing,
  muted, favorite,
  onSend, onTyping, onBack,
  onVoiceCall, onVideoCall,
  onDeleteMessage, onReactMessage,
  onAction,
}) {
  const bottomRef = useRef(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [searchIdx, setSearchIdx] = useState(0);
  const [replyTo, setReplyTo] = useState(null);
  const [confirm, setConfirm] = useState(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, typing]);

  const groups = useMemo(() => groupByDay(messages), [messages]);

  const filteredIds = useMemo(() => {
    if (!searchQ.trim()) return [];
    const q = searchQ.toLowerCase();
    return messages
      .filter((m) => (m.text || '').toLowerCase().includes(q))
      .map((m) => m.id);
  }, [searchQ, messages]);

  const scrollToMessage = (id) => {
    document
      .getElementById(`msg-${id}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

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

  if (!user) return <EmptyState />;

  return (
    <section className="flex-1 flex flex-col min-w-0 chat-bg h-full">
      <ChatHeader
        user={user}
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
          onAction?.(key);
        }}
      />

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
            className="p-1.5 rounded-lg hover:bg-white/5 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto scroll-thin px-2 sm:px-4 md:px-8 py-4 sm:py-5">
        <div className="max-w-3xl mx-auto">
          {groups.map((g) => (
            <div key={g.label}>
              <div className="flex justify-center my-4 sm:my-5">
                <span className="px-3.5 py-1 rounded-full text-[11px] font-medium text-slate-400 bg-white/[0.06] border border-white/5">
                  {g.label}
                </span>
              </div>
              {g.items.map((m) => {
                const isHighlighted = filteredIds[searchIdx] === m.id;
                return (
                  <div
                    key={m.id}
                    id={`msg-${m.id}`}
                    className={
                      isHighlighted
                        ? 'ring-2 ring-brand-500/60 rounded-2xl transition'
                        : ''
                    }
                  >
                    <MessageBubble
                      message={m}
                      mine={m.from === me}
                      onDelete={askDelete}
                      onReply={(msg) => setReplyTo(msg)}
                      onReact={(msg, emoji) => onReactMessage?.(msg, emoji)}
                    />
                  </div>
                );
              })}
            </div>
          ))}

          {typing && <TypingIndicator name={user.name || user.phone} />}
          <div ref={bottomRef} />
        </div>
      </div>

      <MessageInput
        onSend={onSend}
        onTyping={onTyping}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
      />

      <ConfirmDialog
        open={!!confirm}
        title={confirm?.forEveryone ? 'Delete for everyone?' : 'Delete for me?'}
        message={
          confirm?.forEveryone
            ? 'This message will be deleted for everyone in this chat.'
            : 'This message will be removed from your device only.'
        }
        confirmLabel="Delete"
        danger
        onCancel={() => setConfirm(null)}
        onConfirm={doDelete}
      />
    </section>
  );
}