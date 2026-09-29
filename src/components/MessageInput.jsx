import { useEffect, useRef, useState } from 'react';
import {
  Paperclip, Smile, Send, X, Loader2, Mic, Trash2, StopCircle,
  Image as ImageIcon, Film, FileText, Sparkles,
} from 'lucide-react';
import { uploadFile } from '../lib/socket';
import { formatBytes } from '../lib/format';
import { useVoiceRecorder } from '../hooks/useVoiceRecorder';
import EmojiPicker from './EmojiPicker';
import GifPicker from './GifPicker';

export default function MessageInput({
  onSend, onTyping, disabled, replyTo, onCancelReply,
}) {
  const [text, setText] = useState('');
  const [files, setFiles] = useState([]);      // array of {file, preview, progress, url, meta}
  const [dragging, setDragging] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showGif, setShowGif] = useState(false);

  const taRef = useRef(null);
  const fileRef = useRef(null);
  const typingTimer = useRef(null);
  const isTyping = useRef(false);
  const dragDepth = useRef(0);

  const recorder = useVoiceRecorder();

  /* -------- auto-resize -------- */
  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [text]);

  /* -------- typing emit -------- */
  const handleChange = (e) => {
    setText(e.target.value);
    if (!isTyping.current) { isTyping.current = true; onTyping(true); }
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      isTyping.current = false;
      onTyping(false);
    }, 1400);
  };

  /* -------- file add (single or multiple) -------- */
  const addFiles = (list) => {
    const arr = [...list];
    const accepted = arr
      .filter((f) => f.size <= 25 * 1024 * 1024)
      .slice(0, 10 - files.length);
    if (arr.length !== accepted.length) {
      alert('Some files skipped (max 25MB, max 10 files)');
    }
    const items = accepted.map((f) => ({
      file: f,
      preview: f.type.startsWith('image/') ? URL.createObjectURL(f) : null,
      progress: 0,
      url: null,
      meta: null,
    }));
    setFiles((prev) => [...prev, ...items]);
  };

  const removeFile = (idx) => {
    setFiles((prev) => {
      const item = prev[idx];
      if (item?.preview) URL.revokeObjectURL(item.preview);
      return prev.filter((_, i) => i !== idx);
    });
  };

  /* -------- drag & drop -------- */
  const onDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current++;
    if (e.dataTransfer?.types?.includes('Files')) setDragging(true);
  };

  const onDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current--;
    if (dragDepth.current <= 0) {
      dragDepth.current = 0;
      setDragging(false);
    }
  };

  const onDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  };

  const onDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current = 0;
    setDragging(false);
    if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files);
  };

  /* -------- paste images from clipboard -------- */
  const onPaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const filesArr = [];
    for (const it of items) {
      if (it.kind === 'file') {
        const f = it.getAsFile();
        if (f) filesArr.push(f);
      }
    }
    if (filesArr.length) {
      e.preventDefault();
      addFiles(filesArr);
    }
  };

  /* -------- send (with upload) -------- */
  const submit = async () => {
    if (disabled) return;
    if (!text.trim() && files.length === 0) return;

    // upload all files in parallel
    let metas = [];
    if (files.length > 0) {
      try {
        // Update individual progress per file
        const uploads = files.map((item, i) =>
          uploadFile(item.file, (p) => {
            setFiles((prev) => prev.map((f, idx) => idx === i ? { ...f, progress: p } : f));
          }).then((res) => ({
            url: res.url, name: res.name, size: res.size, mime: res.mime,
          }))
        );
        metas = await Promise.all(uploads);
      } catch {
        alert('Upload failed. Try again.');
        return;
      }
    }

    // Send message (with first file as primary, rest as extra array — server will store as array)
    onSend({
      text: text.trim(),
      file: metas[0] || null,
      files: metas,   // server can iterate if needed
      replyTo: replyTo ? {
        id: replyTo.id,
        fromName: replyTo.fromName,
        preview: replyTo.text || (replyTo.file ? '📎 File' : replyTo.gif ? '🎬 GIF' : ''),
      } : null,
    });

    // cleanup
    files.forEach((f) => f.preview && URL.revokeObjectURL(f.preview));
    setText('');
    setFiles([]);
    setShowEmoji(false);
    setShowGif(false);
    onCancelReply?.();
    clearTimeout(typingTimer.current);
    isTyping.current = false;
    onTyping(false);
    taRef.current?.focus();
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey) {
      e.preventDefault();
      submit();
    }
  };

  /* -------- emoji pick -------- */
  const addEmoji = (emoji) => {
    setText((t) => t + emoji);
    taRef.current?.focus();
  };

  /* -------- gif pick -------- */
  const pickGif = (gif) => {
    onSend({
      text: '',
      file: null,
      gif: { url: gif.url, preview: gif.preview },
      replyTo: replyTo ? { id: replyTo.id, fromName: replyTo.fromName, preview: replyTo.text || '' } : null,
    });
    setShowGif(false);
    onCancelReply?.();
  };

  /* -------- voice recording -------- */
  const startRecording = async () => {
    const ok = await recorder.start();
    if (!ok) alert('Microphone permission denied');
  };

  const stopAndSend = async () => {
    const res = await recorder.stop();
    if (!res) return;
    try {
      const meta = await uploadFile(res.blob, () => {});
      onSend({
        text: '',
        file: null,
        voice: { url: meta.url, duration: recorder.seconds || 1, size: meta.size },
        replyTo: replyTo ? { id: replyTo.id, fromName: replyTo.fromName, preview: '🎤 Voice' } : null,
      });
      URL.revokeObjectURL(res.url);
      onCancelReply?.();
    } catch {
      alert('Voice upload failed');
    }
  };

  const uploading = files.some((f) => f.progress > 0 && f.progress < 100);
  const hasContent = text.trim() || files.length > 0;
  const fmt = (s) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <div
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className="relative border-t border-white/5 bg-ink-800/80 backdrop-blur-xl"
    >
      {/* drag overlay */}
      {dragging && (
        <div className="absolute inset-0 z-40 bg-brand-500/10 border-2 border-dashed border-brand-500/60 rounded-lg flex flex-col items-center justify-center pointer-events-none">
          <ImageIcon className="w-10 h-10 text-brand-400 mb-2" />
          <p className="text-sm font-semibold text-brand-400">Drop files here</p>
          <p className="text-xs text-brand-400/70">Images, videos, documents</p>
        </div>
      )}

      {/* reply banner */}
      {replyTo && (
        <div className="px-3 pt-3">
          <div className="flex items-center gap-3 p-2.5 rounded-xl bg-ink-900/70 border-l-4 border-brand-500 animate-pop-in">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold text-brand-400 truncate">
                Replying to {replyTo.fromName || 'message'}
              </p>
              <p className="text-xs text-slate-400 truncate">
                {replyTo.text || (replyTo.file ? '📎 File' : replyTo.gif ? '🎬 GIF' : replyTo.voice ? '🎤 Voice' : '')}
              </p>
            </div>
            <button onClick={onCancelReply} className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* emoji picker */}
      {showEmoji && (
        <EmojiPicker onPick={addEmoji} onClose={() => setShowEmoji(false)} />
      )}

      {/* gif picker */}
      {showGif && (
        <GifPicker onPick={pickGif} onClose={() => setShowGif(false)} />
      )}

      {/* files preview grid */}
      {files.length > 0 && (
        <div className="px-3 pt-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 animate-pop-in">
            {files.map((item, i) => (
              <div key={i} className="relative group rounded-xl overflow-hidden bg-ink-900/70 border border-white/10">
                {item.preview ? (
                  <img src={item.preview} alt="" className="w-full h-24 object-cover" />
                ) : (
                  <div className="w-full h-24 flex items-center justify-center">
                    {item.file.type.startsWith('video/') ? (
                      <Film className="w-8 h-8 text-slate-400" />
                    ) : (
                      <FileText className="w-8 h-8 text-slate-400" />
                    )}
                  </div>
                )}

                <div className="absolute inset-x-0 bottom-0 p-1.5 bg-gradient-to-t from-black/80 to-transparent">
                  <p className="text-[10px] text-white truncate">{item.file.name}</p>
                  <p className="text-[9px] text-white/70">{formatBytes(item.file.size)}</p>
                </div>

                {item.progress > 0 && item.progress < 100 && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <div className="w-12 h-12 relative">
                      <svg className="w-12 h-12 -rotate-90">
                        <circle cx="24" cy="24" r="20" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="3" />
                        <circle
                          cx="24" cy="24" r="20" fill="none" stroke="#10b981" strokeWidth="3"
                          strokeDasharray={`${2 * Math.PI * 20}`}
                          strokeDashoffset={`${2 * Math.PI * 20 * (1 - item.progress / 100)}`}
                          strokeLinecap="round"
                        />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold">{item.progress}%</span>
                    </div>
                  </div>
                )}

                {!uploading && (
                  <button
                    onClick={() => removeFile(i)}
                    className="absolute top-1.5 right-1.5 p-1 rounded-lg bg-black/60 text-slate-300 hover:text-red-400 transition opacity-0 group-hover:opacity-100"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* recording bar */}
      {recorder.recording ? (
        <div className="px-3 py-3 flex items-center gap-3">
          <button
            onClick={recorder.cancel}
            className="p-2.5 rounded-xl text-red-400 hover:bg-red-500/10 transition"
            title="Cancel"
          >
            <Trash2 className="w-5 h-5" />
          </button>
          <div className="flex-1 flex items-center gap-3 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-sm font-medium text-red-400">Recording…</span>
            <span className="ml-auto text-sm font-mono text-red-300">{fmt(recorder.seconds)}</span>
          </div>
          <button
            onClick={stopAndSend}
            className="p-3 rounded-2xl bg-gradient-to-br from-brand-500 to-emerald-600 shadow-lg shadow-brand-500/25 hover:brightness-110 active:scale-95 transition"
            title="Send"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      ) : (
        /* composer */
        <div className="flex items-end gap-2 px-3 py-3">
          <input
            ref={fileRef}
            type="file"
            multiple
            hidden
            onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }}
          />

          <button
            onClick={() => { setShowEmoji((s) => !s); setShowGif(false); }}
            className={`p-2.5 rounded-xl transition ${showEmoji ? 'text-brand-400 bg-brand-500/10' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}
            title="Emoji"
          >
            <Smile className="w-5 h-5" />
          </button>

          <button
            onClick={() => { setShowGif((s) => !s); setShowEmoji(false); }}
            className={`p-2.5 rounded-xl transition hidden sm:block ${showGif ? 'text-brand-400 bg-brand-500/10' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}
            title="GIF"
          >
            <Sparkles className="w-5 h-5" />
          </button>

          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="p-2.5 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-white/5 transition disabled:opacity-40"
            title="Attach (multi-select supported)"
          >
            <Paperclip className="w-5 h-5" />
          </button>

          <textarea
            ref={taRef}
            rows={1}
            value={text}
            onChange={handleChange}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
            placeholder="Type a message… (Ctrl+V paste image, drag & drop files)"
            className="flex-1 resize-none px-4 py-2.5 max-h-[140px] rounded-2xl bg-ink-900/70 border border-white/10 text-[15px] placeholder-slate-500 outline-none transition focus:border-brand-500/40 focus:ring-4 focus:ring-brand-500/10 scroll-thin"
          />

          {hasContent ? (
            <button
              onClick={submit}
              disabled={disabled || uploading}
              className="p-3 rounded-2xl bg-gradient-to-br from-brand-500 to-emerald-600 shadow-lg shadow-brand-500/25 transition hover:brightness-110 active:scale-95 disabled:opacity-35"
              title="Send"
            >
              {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </button>
          ) : (
            <button
              onClick={startRecording}
              disabled={disabled}
              className="p-3 rounded-2xl bg-gradient-to-br from-red-500 to-pink-600 shadow-lg shadow-red-500/20 transition hover:brightness-110 active:scale-95 disabled:opacity-35"
              title="Hold to record voice"
            >
              <Mic className="w-5 h-5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}