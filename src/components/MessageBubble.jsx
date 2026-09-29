import { useState } from 'react';
import {
  Check, CheckCheck, Download, FileText, X,
  Trash2, Copy, Reply, Smile,
} from 'lucide-react';
import { formatTime, formatBytes } from '../lib/format';

function Ticks({ status }) {
  if (status === 'seen') return <CheckCheck className="w-3.5 h-3.5 text-sky-400" />;
  if (status === 'delivered') return <CheckCheck className="w-3.5 h-3.5 text-slate-300" />;
  return <Check className="w-3.5 h-3.5 text-slate-300" />;
}

const REACTIONS = ['❤️', '👍', '😂', '😮', '😢', '🙏'];

export default function MessageBubble({
  message, mine, onDelete, onReply, onReact, showName,
}) {
  const [lightbox, setLightbox] = useState(false);
  const [reactOpen, setReactOpen] = useState(false);
  const [ctx, setCtx] = useState({ open: false, x: 0, y: 0 });

  const file = message.file;
  const gif = message.gif;
  const voice = message.voice;
  const isImage = file?.mime?.startsWith('image/');
  const isVideo = file?.mime?.startsWith('video/');

  const onContext = (e) => {
    e.preventDefault();
    setCtx({ open: true, x: e.clientX, y: e.clientY });
  };

  const reactions = message.reactions || {};
  const reactionEmojis = Object.keys(reactions);

  /* ---- deleted placeholder ---- */
  if (message.deleted) {
    return (
      <div className={`flex mb-1.5 ${mine ? 'justify-end' : 'justify-start'}`}>
        <div className={`max-w-[70%] rounded-2xl px-4 py-2.5 italic text-sm text-slate-400 border border-dashed border-white/10 ${mine ? 'bg-brand-900/20' : 'bg-ink-600/60'}`}>
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
      <div className={`flex mb-1.5 animate-fade-up ${mine ? 'justify-end' : 'justify-start'}`}>
        <div
          onContextMenu={onContext}
          className={`group relative max-w-[78%] sm:max-w-[65%] lg:max-w-[55%] rounded-2xl px-1.5 pt-1.5 pb-1 shadow-lg transition
            ${mine
              ? 'bg-gradient-to-br from-brand-600 to-emerald-700 rounded-br-md'
              : 'bg-ink-600/90 border border-white/5 rounded-bl-md'}`}
        >
          {/* reply preview */}
          {message.replyTo && (
            <div className={`mx-2 mt-1 mb-1 px-2.5 py-1.5 rounded-lg border-l-2 ${mine ? 'bg-black/20 border-white/60' : 'bg-black/30 border-brand-400'}`}>
              <p className="text-[11px] font-semibold opacity-80 truncate">
                {message.replyTo.fromName || 'Reply'}
              </p>
              <p className="text-[11px] opacity-70 truncate">
                {message.replyTo.preview || 'Message'}
              </p>
            </div>
          )}

          {/* image */}
          {isImage && (
            <button onClick={() => setLightbox(true)} className="block w-full overflow-hidden rounded-xl">
              <img src={file.url} alt={file.name} loading="lazy" className="w-full max-h-80 object-cover hover:scale-[1.02] transition duration-300" />
            </button>
          )}

          {/* video */}
          {isVideo && (
            <video src={file.url} controls className="w-full max-h-80 rounded-xl bg-black" />
          )}

          {/* GIF */}
          {gif && (
            <div className="rounded-xl overflow-hidden">
              <img src={gif.url} alt="gif" className="w-full max-h-72 object-contain" />
            </div>
          )}

          {/* voice */}
          {voice && (
            <div className="px-2.5 py-2 min-w-[220px]">
              <audio controls src={voice.url} className="w-full" style={{ height: 36 }} />
              <p className="text-[10px] opacity-70 mt-0.5">{voice.duration ? `${voice.duration}s` : ''}</p>
            </div>
          )}

          {/* generic file */}
          {file && !isImage && !isVideo && (
            <a
              href={file.url}
              download={file.name}
              target="_blank"
              rel="noreferrer"
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
            </a>
          )}

          {/* text + meta */}
          <div className="px-2.5 pt-1 pb-0.5">
            {message.text && (
              <p className="text-[14.5px] leading-relaxed whitespace-pre-wrap break-words">
                {message.text}
              </p>
            )}
            <div className={`flex items-center justify-end gap-1 mt-1 ${mine ? 'text-white/70' : 'text-slate-400'}`}>
              <span className="text-[10px] tabular-nums">{formatTime(message.time)}</span>
              {mine && <Ticks status={message.status} />}
            </div>
          </div>

          {/* hover actions */}
          <div className={`absolute top-1 ${mine ? 'left-1 -translate-x-full' : 'right-1 translate-x-full'} opacity-0 group-hover:opacity-100 transition flex gap-0.5 px-1`}>
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
            <div className={`absolute top-full mt-1 ${mine ? 'right-0' : 'left-0'} z-20 glass rounded-full px-2 py-1 flex gap-0.5 border border-white/10 animate-pop-in`}>
              {REACTIONS.map((r) => (
                <button
                  key={r}
                  onClick={() => { onReact?.(message, r); setReactOpen(false); }}
                  className="text-xl p-1 rounded-full hover:bg-white/10 transition"
                >
                  {r}
                </button>
              ))}
            </div>
          )}

          {/* reactions display */}
          {reactionEmojis.length > 0 && (
            <div className={`absolute -bottom-2.5 ${mine ? 'right-2' : 'left-2'} flex gap-0.5 px-1.5 py-0.5 rounded-full bg-ink-900/95 border border-white/10 shadow-lg text-xs z-10`}>
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
        <div
          className="fixed z-[110] py-1 glass rounded-xl shadow-2xl border border-white/10 animate-pop-in min-w-[180px]"
          style={{ left: ctx.x, top: ctx.y }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => { navigator.clipboard.writeText(message.text || ''); onReply?.(null, true); setCtx({ open: false }); }}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-white/5"
          >
            <Copy className="w-4 h-4" /> Copy text
          </button>
          <button
            onClick={() => { onReply?.(message); setCtx({ open: false }); }}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-white/5"
          >
            <Reply className="w-4 h-4" /> Reply
          </button>
          <div className="h-px my-1 bg-white/10" />
          {mine && (
            <button
              onClick={() => { onDelete?.(message, true); setCtx({ open: false }); }}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10"
            >
              <Trash2 className="w-4 h-4" /> Delete for everyone
            </button>
          )}
          <button
            onClick={() => { onDelete?.(message, false); setCtx({ open: false }); }}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10"
          >
            <Trash2 className="w-4 h-4" /> Delete for me
          </button>
        </div>
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