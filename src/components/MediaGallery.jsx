import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Download, X, CalendarDays, Images } from 'lucide-react';
import { downloadAttachment } from '../lib/download-attachment';
import { resolveMediaUrl } from '../lib/media-url';

const dayKey = value => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Unknown date' : date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
};
/** One gallery for the whole conversation, with day-specific navigation and keyboard support. */
export default function MediaGallery({ items, initialId, onClose }) {
  const [id, setId] = useState(initialId);
  const [scope, setScope] = useState('day');
  const [error, setError] = useState('');
  const current = items.find(m => m.id === id) || items[0];
  const date = current ? dayKey(current.time) : '';
  const visible = useMemo(() => scope === 'day' ? items.filter(m => dayKey(m.time) === date) : items, [items, date, scope]);
  const index = Math.max(0, visible.findIndex(m => m.id === current?.id));
  const move = delta => {
    if (!visible.length) return;
    setError('');
    setId(visible[(index + delta + visible.length) % visible.length].id);
  };
  useEffect(() => {
    const key = event => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); }
      if (event.key === 'ArrowRight') { event.preventDefault(); move(1); }
      if (event.key === 'ArrowLeft') { event.preventDefault(); move(-1); }
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  });
  if (!current) return null;
  const media = current.file || current.gif;
  return (
    <div className="pulse-media-gallery fixed inset-0 z-[180] bg-[#090a10]/95 text-white flex flex-col safe-top safe-bottom" role="dialog" aria-modal="true" aria-label="Conversation media gallery">
      <header className="flex items-center gap-3 px-3 sm:px-6 py-3 bg-black/35 border-b border-white/10">
        <Images size={20}/><div className="min-w-0 flex-1"><h2 className="font-semibold text-sm">Conversation gallery</h2><p className="text-xs text-white/60 truncate">{date} · {index + 1} / {visible.length}</p></div>
        <button className="p-2 rounded-xl hover:bg-white/10 flex gap-1 items-center text-xs" onClick={() => setScope(v => v === 'day' ? 'all' : 'day')} title="Switch between this date and all media"><CalendarDays size={16}/> {scope === 'day' ? 'This day' : 'All dates'}</button>
        <button className="p-2 rounded-xl hover:bg-white/10" title="Download" aria-label="Download media" onClick={() => downloadAttachment(media).catch(e => setError(e.message))}><Download size={19}/></button>
        <button className="p-2 rounded-xl hover:bg-white/10" aria-label="Close gallery" onClick={onClose}><X size={22}/></button>
      </header>
      <main className="min-h-0 flex-1 flex items-center justify-between gap-1 sm:gap-5 px-2 sm:px-6">
        <button onClick={() => move(-1)} aria-label="Previous image" className="p-2 sm:p-3 shrink-0 rounded-full bg-white/10 hover:bg-white/20"><ArrowLeft/></button>
        <div className="min-w-0 flex-1 flex items-center justify-center h-full overflow-hidden">
          {current.file?.mime?.startsWith('video/') ? <video key={id} src={resolveMediaUrl(media.url)} controls autoPlay playsInline className="max-h-[75dvh] max-w-full rounded-xl" /> : <img key={id} src={resolveMediaUrl(media.url)} alt={media.name || 'Shared image'} className="max-h-[75dvh] max-w-full object-contain rounded-lg" />}
        </div>
        <button onClick={() => move(1)} aria-label="Next image" className="p-2 sm:p-3 shrink-0 rounded-full bg-white/10 hover:bg-white/20"><ArrowRight/></button>
      </main>
      {error && <p role="alert" className="text-center text-red-300 text-sm">{error}</p>}
      <footer className="flex gap-2 overflow-x-auto px-3 py-3 justify-start sm:justify-center bg-black/35 border-t border-white/10 scroll-thin">
        {visible.map(m => <button key={m.id} aria-label={`Show media from ${new Date(m.time).toLocaleString()}`} aria-current={m.id === current.id} onClick={() => setId(m.id)} className={`w-14 h-14 shrink-0 rounded-lg overflow-hidden border-2 ${m.id === current.id ? 'border-violet-400' : 'border-transparent opacity-65 hover:opacity-100'}`}>
          {m.file?.mime?.startsWith('video/') ? <video muted src={resolveMediaUrl(m.file.url)} className="w-full h-full object-cover"/> : <img src={resolveMediaUrl((m.file || m.gif).url)} alt="" loading="lazy" className="w-full h-full object-cover"/>}
        </button>)}
      </footer>
    </div>
  );
}
