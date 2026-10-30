import { useEffect, useRef, useState } from 'react';
import {
  Check,
  CheckCheck,
  Download,
  FileText,
  X,
  Trash2,
  Copy,
  Reply,
  Smile,
  Star,
  Pencil,
  Forward,
  ListTodo,
  Lightbulb,
  Plus,
} from 'lucide-react';
import { formatTime, formatBytes } from '../lib/format';
import WorkCards from './WorkCards';
import VoiceNotePlayer from './VoiceNotePlayer';
import EmojiPicker from './EmojiPicker';
import { downloadAttachment } from '../lib/download-attachment';

function Ticks({ status }) {
  if (status === 'seen') return <CheckCheck className="w-3.5 h-3.5 text-sky-400" />;
  if (status === 'delivered') return <CheckCheck className="w-3.5 h-3.5 text-slate-300" />;
  return <Check className="w-3.5 h-3.5 text-slate-300" />;
}

const REACTIONS = ['❤️', '👍', '😂', '😮', '😢', '🙏'];

export default function MessageBubble({
  message,
  people = [],
  mine,
  onDelete,
  onReply,
  onReact,
  showName,
  onEdit,
  onForward,
  onStar,
  starred,
  me,
  onCardAction,
  onOpenContact,
  onTask,
  onDecision,
}) {
  const [lightbox, setLightbox] = useState(false);
  const [reactOpen, setReactOpen] = useState(false);
  const [allReactions, setAllReactions] = useState(false);
  const [ctx, setCtx] = useState({ open: false, x: 0, y: 0 });
  const [copyError, setCopyError] = useState('');
  const [downloadError, setDownloadError] = useState('');
  const saveFile = async (data) => {
    setDownloadError('');
    try { await downloadAttachment(data); }
    catch (error) { setDownloadError(error.message); }
  };
  const pressTimer = useRef(null);
  const pressStart = useRef(null);
  useEffect(() => {
    if (!ctx.open) return;
    const close = (e) => {
      if (e.key === 'Escape') setCtx({ open: false });
    };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [ctx.open]);

  const file = message.file;
  const gif = message.gif;
  const voice = message.voice;
  const isImage = file?.mime?.startsWith('image/');
  const isVideo = file?.mime?.startsWith('video/');
  const isAudio = file?.mime?.startsWith('audio/');

  const onContext = (e) => {
    e.preventDefault();
    setCtx({
      open: true,
      x: Math.max(8, Math.min(e.clientX, window.innerWidth - 210)),
      y: Math.max(8, Math.min(e.clientY, window.innerHeight - 370)),
    });
  };

  const reactions = message.reactions || {};
  const reactionEmojis = Object.keys(reactions);

  /* ---- deleted placeholder ---- */
  if (message.deleted) {
    return (
      <div className={`flex mb-1.5 ${mine ? 'justify-end' : 'justify-start'}`}>
        <div
          className={`max-w-[70%] rounded-2xl px-4 py-2.5 italic text-sm text-slate-400 border border-dashed border-white/10 ${mine ? 'bg-brand-900/20' : 'bg-ink-600/60'}`}
        >
          🚫 This message was deleted
          <div className="text-[10px] text-slate-500 mt-1 text-right not-italic">
            {formatTime(message.time)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        className={`flex ${reactionEmojis.length ? 'mb-4' : 'mb-1'} animate-fade-up ${mine ? 'justify-end' : 'justify-start'}`}
      >
        <div
          onContextMenu={onContext}
          onTouchStart={(e) => { const t = e.touches[0]; pressStart.current = { x: t.clientX, y: t.clientY }; clearTimeout(pressTimer.current); pressTimer.current = setTimeout(() => onContext({ preventDefault() {}, clientX: pressStart.current.x, clientY: pressStart.current.y }), 550); }}
          onTouchMove={(e) => { if (pressStart.current && Math.hypot(e.touches[0].clientX - pressStart.current.x, e.touches[0].clientY - pressStart.current.y) > 12) clearTimeout(pressTimer.current); }}
          onTouchEnd={() => clearTimeout(pressTimer.current)}
          onTouchCancel={() => clearTimeout(pressTimer.current)}
          className={`message-bubble group relative max-w-[88%] sm:max-w-[75%] lg:max-w-[65%] rounded-xl px-1.5 pt-1 pb-1 transition ${mine ? 'bubble-mine' : 'bubble-theirs'}
            ${
              mine
                ? 'bg-gradient-to-br from-brand-600 to-emerald-700 rounded-br-md'
                : 'bg-ink-600/90 border border-white/5 rounded-bl-md'
            }`}
        >
          {(showName || message.forwarded) && (
            <div className="flex items-center gap-2 px-2 pt-0.5 text-[10px]">
              {showName && <span className="font-semibold">{message.fromName}</span>}
              {message.forwarded && <i className="opacity-70">Forwarded</i>}
            </div>
          )}
          {/* reply preview */}
          {message.replyTo && (
            <div
              className={`mx-2 mt-1 mb-1 px-2.5 py-1.5 rounded-lg border-l-2 ${mine ? 'bg-black/20 border-white/60' : 'bg-black/30 border-brand-400'}`}
            >
              <p className="text-[11px] font-semibold opacity-80 truncate">
                {message.replyTo.fromName || 'Reply'}
              </p>
              <p className="text-[11px] opacity-70 truncate">
                {message.replyTo.preview || 'Message'}
              </p>
            </div>
          )}

          <WorkCards
            message={message}
            me={me}
            onAction={onCardAction}
            onOpenContact={onOpenContact}
          />

          {/* image */}
          {isImage && (
            <div className="relative block w-full overflow-hidden rounded-xl group">
              <button
                onClick={() => setLightbox(true)}
                className="block w-full overflow-hidden rounded-xl"
              >
                <img
                  src={file.url}
                  alt={file.name}
                  loading="lazy"
                  className="w-full max-h-80 object-cover hover:scale-[1.02] transition duration-300"
                />
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); saveFile(file); }}
                className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                title="Download image"
              >
                <Download size={14} />
              </button>
            </div>
          )}

          {/* video */}
          {isVideo && (
            <div className="relative w-full max-h-80 rounded-xl group">
              <video src={file.url} controls className="w-full max-h-80 rounded-xl bg-black" />
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); saveFile(file); }}
                className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                title="Download video"
              >
                <Download size={14} />
              </button>
            </div>
          )}
          {isAudio && (
            <div className="px-2.5 py-2 min-w-[220px]">
              <p className="text-xs mb-2 truncate">{file.name}</p>
              <audio controls src={file.url} className="w-full" style={{ height: 36 }} />
            </div>
          )}

          {/* GIF */}
          {gif && (
            <div className="rounded-xl overflow-hidden">
              <img src={gif.url} alt="gif" className="w-full max-h-72 object-contain" />
            </div>
          )}

          {/* voice */}
          {voice && (
            <VoiceNotePlayer src={voice.url} duration={voice.duration} mine={mine} />
          )}

          {/* generic file */}
          {file && !isImage && !isVideo && !isAudio && (
            <button
              type="button"
              onClick={() => saveFile(file)}
              className="flex items-center gap-3 px-2.5 py-2.5 rounded-xl bg-black/25 hover:bg-black/40 transition"
            >
              <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{file.name}</p>
                <p className="text-[11px] opacity-70">{formatBytes(file.size)}</p>
              </div>
              <Download className="w-4 h-4 opacity-70 shrink-0" />
            </button>
          )}

          {(file || voice) && (
            <button className="attachment-download" type="button" onClick={() => saveFile(file || voice)} title="Download attachment">
              <Download size={14} /> Download {file?.name ? file.name.slice(0, 24) : 'voice message'}
            </button>
          )}
          {downloadError && <p role="alert" className="text-xs px-2 text-red-300">{downloadError}</p>}
          {/* text + meta */}
          <div className="px-2.5 pt-1 pb-0.5">
            {message.text && (
              <p className="text-[14.5px] leading-relaxed whitespace-pre-wrap break-words">
                {message.text.split(/(https?:\/\/[^\s<>]+)/g).map((part, i) =>
                  /^https?:\/\//.test(part) ? (
                    <a
                      key={i}
                      href={part}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline underline-offset-2 break-all"
                    >
                      {part}
                    </a>
                  ) : (
                    part
                  )
                )}
              </p>
            )}
            <div
              className={`flex items-center justify-end gap-1 mt-1 ${mine ? 'text-white/70' : 'text-slate-400'}`}
            >
              {starred && <Star size={10} className="text-yellow-300 fill-yellow-300" />}
              {message.editedAt && <span className="text-[9px]">edited</span>}
              {message.expiresAt && (
                <span
                  className="text-[9px]"
                  title={`Disappears ${new Date(message.expiresAt).toLocaleString()}`}
                >
                  ◷
                </span>
              )}
              <span className="text-[10px] tabular-nums">{formatTime(message.time)}</span>
              {mine && (
                <span
                  title={`${message.readBy?.filter((p) => p !== message.from).length || 0} read · ${message.deliveredTo?.filter((p) => p !== message.from).length || 0} delivered`}
                >
                  <Ticks status={message.status} />
                </span>
              )}
            </div>
          </div>

          {/* hover actions */}
          <div
            className={`absolute top-1 ${mine ? 'left-1 -translate-x-full' : 'right-1 translate-x-full'} opacity-0 group-hover:opacity-100 transition flex gap-0.5 px-1`}
          >
            <button
              onClick={() => setReactOpen((s) => !s)}
              className="p-1.5 rounded-full bg-ink-800/90 border border-white/10 hover:bg-ink-700"
              title="React"
            >
              <Smile className="w-3.5 h-3.5 text-slate-300" />
            </button>
            <button
              onClick={() => onReply?.(message)}
              className="p-1.5 rounded-full bg-ink-800/90 border border-white/10 hover:bg-ink-700"
              title="Reply"
            >
              <Reply className="w-3.5 h-3.5 text-slate-300" />
            </button>
          </div>

          {/* reaction picker */}
          {reactOpen && (
            <div
              className={`absolute top-full mt-1 ${mine ? 'right-0' : 'left-0'} z-20 glass rounded-full px-2 py-1 flex gap-0.5 border border-white/10 animate-pop-in`}
            >
              {REACTIONS.map((r) => (
                <button
                  key={r}
                  onClick={() => {
                    onReact?.(message, r);
                    setReactOpen(false);
                  }}
                  className="text-xl p-1 rounded-full hover:bg-white/10 transition"
                >
                  {r}
                </button>
              ))}
              <button aria-label="More reactions" title="More reactions" type="button"
                onClick={() => { setReactOpen(false); setAllReactions(true); }}
                className="text-xl p-1 rounded-full hover:bg-white/10"><Plus size={17}/></button>
            </div>
          )}
          {allReactions && <EmojiPicker onPick={(emoji) => {
            onReact?.(message, emoji);
            setAllReactions(false);
          }} onClose={() => setAllReactions(false)} />}

          {/* reactions display */}
          {reactionEmojis.length > 0 && (
            <div
              className={`absolute -bottom-2.5 ${mine ? 'right-2' : 'left-2'} flex gap-0.5 px-1.5 py-0.5 rounded-full bg-ink-900/95 border border-white/10 shadow-lg text-xs z-10`}
            >
              {reactionEmojis.map((r) => (
                <span key={r} title={`${reactions[r].length}`}>
                  {r}
                  {reactions[r].length > 1 && (
                    <span className="text-[9px] ml-0.5 text-slate-400">{reactions[r].length}</span>
                  )}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* context menu */}
      {ctx.open && (
        <>
          <div className="fixed inset-0 z-[109]" onClick={() => setCtx({ open: false })} />
          <div
            className="fixed z-[110] py-1 glass rounded-xl shadow-2xl border border-white/10 animate-pop-in min-w-[180px]"
            style={{ left: ctx.x, top: ctx.y }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {mine && <div className="px-3 py-2 text-xs border-b border-white/10">
              <strong>Message info</strong>
              <span className="block opacity-75 mt-1">Delivered: {Math.max(0, message.deliveredTo?.filter(p => p !== message.from).length || 0)} · Read: {Math.max(0, message.readBy?.filter(p => p !== message.from).length || 0)}</span>
              {message.readBy?.filter(p => p !== message.from).map(phone => (
                <span key={phone} className="block opacity-75 leading-5">
                  {people.find(p => p.phone === phone)?.name || phone} · {message.readAt?.[phone] ? new Date(message.readAt[phone]).toLocaleString() : 'Read'}
                </span>
              ))}
            </div>}
            <button
              onClick={async () => {
                setCtx({ open: false });
                await saveFile(message.file || message.voice || message.gif);
              }}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-white/5"
            >
              <Download className="w-4 h-4" /> Download
            </button>
            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(
                    message.text ||
                      message.file?.url ||
                      message.voice?.url ||
                      message.gif?.url ||
                      ''
                  );
                  setCtx({ open: false });
                } catch {
                  setCopyError('Clipboard unavailable in this browser.');
                }
              }}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-white/5"
            >
              <Copy className="w-4 h-4" /> Copy text
            </button>
            <button
              onClick={() => {
                onReply?.(message);
                setCtx({ open: false });
              }}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-white/5"
            >
              <Reply className="w-4 h-4" /> Reply
            </button>
            <button
              className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-white/5"
              onClick={() => {
                onForward?.(message);
                setCtx({ open: false });
              }}
            >
              <Forward size={16} />
              Forward
            </button>
            <button
              className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-white/5"
              onClick={() => {
                onStar?.(message);
                setCtx({ open: false });
              }}
            >
              <Star size={16} />
              {starred ? 'Unstar message' : 'Star message'}
            </button>
            <button
              className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-white/5"
              onClick={() => {
                onTask?.(message);
                setCtx({ open: false });
              }}
            >
              <ListTodo size={16} />
              Turn into a task
            </button>
            <button
              className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-white/5"
              onClick={() => {
                onDecision?.(message);
                setCtx({ open: false });
              }}
            >
              <Lightbulb size={16} />
              Record as decision
            </button>
            {mine && message.text && (
              <button
                className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-white/5"
                onClick={() => {
                  onEdit?.(message);
                  setCtx({ open: false });
                }}
              >
                <Pencil size={16} />
                Edit message
              </button>
            )}
            {copyError && <p className="text-xs text-red-400 px-3 py-2">{copyError}</p>}
            <div className="h-px my-1 bg-white/10" />
            {mine && (
              <button
                onClick={() => {
                  onDelete?.(message, true);
                  setCtx({ open: false });
                }}
                className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10"
              >
                <Trash2 className="w-4 h-4" /> Delete for everyone
              </button>
            )}
            <button
              onClick={() => {
                onDelete?.(message, false);
                setCtx({ open: false });
              }}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10"
            >
              <Trash2 className="w-4 h-4" /> Delete for me
            </button>
          </div>
        </>
      )}

      {/* lightbox */}
      {lightbox && (
        <div
          onClick={() => setLightbox(false)}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-pop-in"
        >
          <button className="absolute top-5 right-5 p-2 rounded-full bg-white/10 hover:bg-white/20 transition">
            <X className="w-5 h-5" />
          </button>
          <button
            className="absolute top-5 left-5 p-2 rounded-full bg-white/10 hover:bg-white/20 transition z-20"
            onClick={(e) => { e.stopPropagation(); saveFile(file); }}
            title="Download image"
          >
            <Download className="w-5 h-5" />
          </button>
          <img
            src={file.url}
            alt={file.name}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[88vh] max-w-[92vw] rounded-2xl shadow-2xl"
          />
        </div>
      )}
    </>
  );
}
