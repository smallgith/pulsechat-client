import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
  Plus,
  Smile,
  Send,
  X,
  Loader2,
  Mic,
  Trash2,
  Image,
  Film,
  FileText,
  Camera,
  Music2,
  UserRound,
  BarChart3,
  CalendarDays,
  Sticker,
  Clock3,
  ListTodo,
  Lightbulb,
  Pause,
  Play,
  Check,
  Sparkles,
  ArrowUpRight,
} from 'lucide-react';
import { uploadFile } from '../lib/socket';
import { formatBytes } from '../lib/format';
import { useVoiceRecorder } from '../hooks/useVoiceRecorder';
import { useAttachments } from '../hooks/useAttachments';
import EmojiPicker from './EmojiPicker';
import GifPicker from './GifPicker';
import CameraCapture from './CameraCapture';

const templates = [
  ['Stand-up update', 'Yesterday:\n• \nToday:\n• \nBlockers:\n• None'],
  ['Meeting notes', 'Meeting notes\n\nKey points:\n• \nDecisions:\n• \nNext steps:\n• '],
  [
    'Friendly follow-up',
    'Hi! A quick follow-up on our last conversation. Could you share an update when you have a moment?',
  ],
  [
    'Share availability',
    'I’m available at the following times:\n• \n• \nWhich works best for you?',
  ],
];
const MessageInput = forwardRef(function MessageInput(
  { onSend, onTyping, disabled, replyTo, onCancelReply, draftKey, onCompose, scheduledDraft },
  ref
) {
  const [text, setText] = useState(() => localStorage.getItem(draftKey) || '');
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [picker, setPicker] = useState(null),
    [cameraOpen, setCameraOpen] = useState(false);
  const textarea = useRef(),
    filesInput = useRef(),
    photosInput = useRef(),
    audioInput = useRef(),
    typingTimer = useRef(),
    sending = useRef(false),
    batch = useRef(null),
    alive = useRef(true),
    menu = useRef();
  const attachments = useAttachments(),
    recorder = useVoiceRecorder();
  const addFiles = (files) => {
    if (disabled || busy) return;
    attachments.add(files);
    batch.current = null;
  };
  useImperativeHandle(ref, () => ({ addFiles }), [
    disabled,
    busy,
    attachments.items,
    attachments.limits,
  ]);
  useEffect(() => {
    if (text) localStorage.setItem(draftKey, text);
    else localStorage.removeItem(draftKey);
    const el = textarea.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
    }
  }, [text, draftKey]);
  useEffect(() => {
    if (
      scheduledDraft &&
      draftKey.endsWith(`.${scheduledDraft.target}`) &&
      scheduledDraft.text === text
    )
      setText('');
  }, [scheduledDraft?.id]);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      clearTimeout(typingTimer.current);
      onTyping(false);
    };
  }, []);
  useEffect(() => {
    if (!picker) return;
    const close = (e) => {
      if (
        e.key === 'Escape' ||
        (e.type === 'pointerdown' && menu.current && !menu.current.contains(e.target))
      )
        setPicker(null);
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', close);
    };
  }, [picker]);
  const changed = (value) => {
    setText(value);
    batch.current = null;
    onTyping(true);
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => onTyping(false), 1400);
  };
  const submit = async () => {
    if (disabled || sending.current || (!text.trim() && !attachments.items.length)) return;
    sending.current = true;
    setBusy(true);
    setError('');
    setPicker(null);
    batch.current ||= crypto.randomUUID();
    try {
      const files = await attachments.uploadAll();
      if (!alive.current) return;
      if (!text.trim() && !files.length) return;
      await onSend({
        clientId: batch.current,
        text: text.trim(),
        file: files[0] || null,
        files,
        replyTo: replyTo ? { id: replyTo.id } : null,
      });
      if (!alive.current) return;
      setText('');
      attachments.clear();
      batch.current = null;
      onCancelReply?.();
      onTyping(false);
      clearTimeout(typingTimer.current);
    } catch (e) {
      if (alive.current) setError(e.message);
    } finally {
      sending.current = false;
      if (alive.current) {
        setBusy(false);
        textarea.current?.focus();
      }
    }
  };
  const voice = async () => {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    setError('');
    const result = await recorder.stop();
    try {
      if (!result) return;
      const file = new File(
        [result.blob],
        `voice-${Date.now()}.${result.blob.type.includes('mp4') ? 'm4a' : 'webm'}`,
        { type: result.blob.type }
      );
      const meta = await uploadFile(file);
      if (alive.current) {
        await onSend({
          voice: { ...meta, duration: result.duration },
          replyTo: replyTo ? { id: replyTo.id } : null,
        });
        onCancelReply?.();
      }
    } catch (e) {
      if (alive.current) setError(e.message);
    } finally {
      if (result) URL.revokeObjectURL(result.url);
      sending.current = false;
      if (alive.current) setBusy(false);
    }
  };
  const choose = (key) => {
    setPicker(null);
    if (key === 'file') filesInput.current.click();
    else if (key === 'photos') photosInput.current.click();
    else if (key === 'audio') audioInput.current.click();
    else if (key === 'camera') setCameraOpen(true);
    else if (key === 'templates') setPicker('templates');
    else onCompose(key, { initialText: text });
  };
  const pickGif = async (gif) => {
    try {
      await onSend({ gif: { url: gif.url }, replyTo: replyTo ? { id: replyTo.id } : null });
      setPicker(null);
      onCancelReply?.();
    } catch (e) {
      setError(e.message);
    }
  };
  const input = (inputRef, accept) => (
    <input
      ref={inputRef}
      type="file"
      accept={accept}
      multiple
      hidden
      onChange={(e) => {
        addFiles(e.target.files);
        e.target.value = '';
      }}
    />
  );
  return (
    <div className="composer" ref={menu}>
      {input(filesInput)}
      {input(photosInput, 'image/*,video/*')}
      {input(audioInput, 'audio/*')}
      {(error || attachments.error) && (
        <p role="alert" className="error-banner !m-2">
          {error || attachments.error}
        </p>
      )}
      {replyTo && (
        <div className="reply-banner">
          <div>
            <strong>Replying to {replyTo.fromName}</strong>
            <p>{replyTo.text || replyTo.task?.title || replyTo.poll?.question || 'Attachment'}</p>
          </div>
          <button className="icon-btn" aria-label="Cancel reply" onClick={onCancelReply}>
            <X size={16} />
          </button>
        </div>
      )}
      {attachments.items.length > 0 && (
        <div className="transfer-queue" aria-label="File upload queue">
          <div className="queue-heading">
            <span>
              {attachments.items.length} files ·{' '}
              {formatBytes(attachments.items.reduce((sum, item) => sum + item.file.size, 0))}
            </span>
            <small>
              Up to {formatBytes(attachments.limits.maxFileSize)} each · resume supported
            </small>
          </div>
          {attachments.items.map((item) => (
            <div className="transfer-item" key={item.id}>
              <div className="transfer-preview">
                {item.preview ? (
                  <img src={item.preview} alt="" />
                ) : item.file.type.startsWith('video/') ? (
                  <Film size={20} />
                ) : item.file.type.startsWith('audio/') ? (
                  <Music2 size={20} />
                ) : (
                  <FileText size={20} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{item.file.name}</p>
                <div className="flex justify-between gap-2 text-[10px] text-slate-400 mt-1">
                  <span>
                    {formatBytes(item.file.size)} ·{' '}
                    {item.status === 'error'
                      ? item.error
                      : item.status === 'ready'
                        ? 'Ready to send'
                        : item.status}
                  </span>
                  <span>{item.progress}%</span>
                </div>
                <progress
                  aria-label={`Upload progress ${item.file.name}`}
                  value={item.progress}
                  max={100}
                />
              </div>
              {['uploading', 'retrying'].includes(item.status) && (
                <button
                  className="icon-btn"
                  aria-label={`Pause ${item.file.name}`}
                  onClick={() => attachments.pause(item.id)}
                >
                  <Pause size={15} />
                </button>
              )}
              {item.status === 'paused' && (
                <button
                  className="icon-btn"
                  aria-label={`Resume ${item.file.name}`}
                  onClick={() => attachments.resume(item.id)}
                >
                  <Play size={15} />
                </button>
              )}
              {item.status === 'uploaded' && <Check size={16} className="text-brand-400" />}
              <button
                className="icon-btn"
                aria-label={`Remove ${item.file.name}`}
                onClick={() => attachments.remove(item.id)}
              >
                <X size={15} />
              </button>
            </div>
          ))}
        </div>
      )}
      {picker === 'attachments' && (
        <div className="attachment-menu" role="menu" aria-label="Attachments">
          {[
            ['file', 'Document', FileText],
            ['photos', 'Photos & videos', Image],
            ['camera', 'Camera', Camera],
            ['audio', 'Audio', Music2],
            ['contact_share', 'Contact', UserRound],
            ['poll', 'Poll', BarChart3],
            ['event', 'Event', CalendarDays],
            ['sticker', 'New sticker', Sticker],
            ['task', 'Shared task', ListTodo],
            ['decision', 'Decision', Lightbulb],
            ['schedule', 'Schedule message', Clock3],
            ['templates', 'Quick templates', Sparkles],
          ].map(([key, label, Icon], i) => (
            <button role="menuitem" key={key} onClick={() => choose(key)}>
              <span className={`attachment-icon attachment-${i % 4}`}>
                <Icon size={19} />
              </span>
              <span>{label}</span>
              <ArrowUpRight size={13} />
            </button>
          ))}
        </div>
      )}
      {picker === 'templates' && (
        <div className="attachment-menu templates-menu">
          <p className="eyebrow px-3 pt-2">A HEAD START FOR YOUR NEXT MESSAGE</p>
          {templates.map(([title, value]) => (
            <button
              key={title}
              onClick={() => {
                changed(value);
                setPicker(null);
                textarea.current?.focus();
              }}
            >
              <Sparkles size={16} />
              <span>{title}</span>
              <ArrowUpRight size={13} />
            </button>
          ))}
        </div>
      )}
      {picker === 'emoji' && (
        <EmojiPicker onPick={(emoji) => changed(text + emoji)} onClose={() => setPicker(null)} />
      )}
      {picker === 'gif' && (
        <GifPicker
          onPick={pickGif}
          onUpload={(file) => {
            addFiles([file]);
            setPicker(null);
          }}
          onClose={() => setPicker(null)}
        />
      )}
      {cameraOpen && (
        <CameraCapture
          onClose={() => setCameraOpen(false)}
          onCapture={(file) => addFiles([file])}
        />
      )}
      {recorder.recording ? (
        <div className="composer-row">
          <button
            className="icon-btn text-red-400"
            aria-label="Cancel recording"
            onClick={recorder.cancel}
          >
            <Trash2 size={20} />
          </button>
          <div className="flex-1 flex items-center gap-3 text-red-400 text-sm">
            <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
            <span>Recording</span>
            <span className="ml-auto font-mono">{`${Math.floor(recorder.seconds / 60)
              .toString()
              .padStart(2, '0')}:${(recorder.seconds % 60).toString().padStart(2, '0')}`}</span>
          </div>
          <button
            className="send-button"
            aria-label="Send voice message"
            disabled={busy}
            onClick={voice}
          >
            <Send size={18} />
          </button>
        </div>
      ) : (
        <div className="composer-row">
          <button
            disabled={disabled || busy}
            aria-label="Attach"
            aria-expanded={picker === 'attachments'}
            className={`composer-plus ${picker === 'attachments' ? 'active' : ''}`}
            onClick={() => setPicker(picker === 'attachments' ? null : 'attachments')}
          >
            <Plus size={22} />
          </button>
          <div className="composer-field">
            <textarea
              aria-label="Message"
              ref={textarea}
              rows={1}
              maxLength={4000}
              placeholder="Message"
              value={text}
              disabled={disabled || busy}
              onChange={(e) => {
                changed(e.target.value);
                if (e.target.value === '/') setPicker('templates');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  submit();
                }
              }}
              onPaste={(e) => {
                const files = [...(e.clipboardData?.items || [])]
                  .filter((i) => i.kind === 'file')
                  .map((i) => i.getAsFile())
                  .filter(Boolean);
                if (files.length) {
                  e.preventDefault();
                  addFiles(files);
                }
              }}
            />
            <button
              className="icon-btn"
              disabled={disabled || busy}
              aria-label="Emoji"
              onClick={() => setPicker(picker === 'emoji' ? null : 'emoji')}
            >
              <Smile size={19} />
            </button>
          </div>
          <button
            className="icon-btn composer-extra"
            disabled={disabled || busy}
            aria-label="Message templates"
            title="Message templates"
            onClick={() => setPicker(picker === 'templates' ? null : 'templates')}
          >
            <Sparkles size={18} />
          </button>
          {
            <button
              className="icon-btn !text-xs !font-bold"
              disabled={disabled || busy}
              aria-label="GIF picker"
              onClick={() => setPicker(picker === 'gif' ? null : 'gif')}
            >
              GIF
            </button>
          }
          <button
            className="icon-btn composer-extra"
            disabled={disabled || busy}
            aria-label="Schedule message"
            title="Schedule message"
            onClick={() => choose('schedule')}
          >
            <Clock3 size={18} />
          </button>
          {busy ? (
            <button className="send-button" aria-label="Sending" disabled>
              <Loader2 className="animate-spin" size={19} />
            </button>
          ) : text.trim() || attachments.items.length ? (
            <button className="send-button" aria-label="Send" disabled={disabled} onClick={submit}>
              <Send size={18} />
            </button>
          ) : (
            <button
              className="send-button"
              aria-label="Record voice"
              disabled={disabled}
              onClick={async () => {
                if (!(await recorder.start()))
                  setError('Allow microphone access and use HTTPS or localhost.');
              }}
            >
              <Mic size={19} />
            </button>
          )}
        </div>
      )}
      <div className="composer-footnote">
        <span>
          {busy
            ? 'Your files travel in verified chunks. Pause or resume any transfer above.'
            : 'A thought, a file, a plan. Drop it here.'}
        </span>
        <span className="hidden sm:inline">Shift + Enter for a new line</span>
      </div>
    </div>
  );
});
export default MessageInput;
