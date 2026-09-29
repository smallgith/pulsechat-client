import { useEffect, useState } from 'react';
import { Search, Loader2, Sparkles } from 'lucide-react';
import { isGiphyEnabled, searchGifs } from '../lib/giphy';

export default function GifPicker({ onPick, onClose }) {
  const [q, setQ] = useState('');
  const [gifs, setGifs] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isGiphyEnabled()) return;
    let cancel = false;
    setLoading(true);
    const t = setTimeout(async () => {
      const data = await searchGifs(q);
      if (!cancel) {
        setGifs(data);
        setLoading(false);
      }
    }, q.trim() ? 350 : 0);
    return () => { cancel = true; clearTimeout(t); };
  }, [q]);

  if (!isGiphyEnabled()) {
    return (
      <div className="absolute bottom-full mb-2 left-2 right-2 sm:left-3 sm:right-auto sm:w-[360px] z-30 glass rounded-2xl p-6 shadow-2xl border border-white/10 text-center animate-pop-in">
        <Sparkles className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
        <p className="text-sm font-medium mb-1">GIPHY not configured</p>
        <p className="text-xs text-slate-400 leading-relaxed">
          Get a free API key at developers.giphy.com and add
          <br />
          <code className="text-brand-400">VITE_GIPHY_API_KEY</code> to your .env
        </p>
      </div>
    );
  }

  return (
    <div className="absolute bottom-full mb-2 left-2 right-2 sm:left-3 sm:right-auto sm:w-[380px] z-30 glass rounded-2xl shadow-2xl border border-white/10 overflow-hidden animate-pop-in">
      <div className="p-2.5 border-b border-white/5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search GIFs…"
            className="w-full pl-8 pr-3 py-2 rounded-lg bg-ink-900/60 border border-white/5 text-sm outline-none focus:border-brand-500/40"
          />
        </div>
      </div>

      <div className="max-h-80 overflow-y-auto scroll-thin p-2">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-5 h-5 animate-spin text-brand-400" />
          </div>
        ) : gifs.length === 0 ? (
          <p className="text-center text-xs text-slate-500 py-10">No GIFs found</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {gifs.map((g) => (
              <button
                key={g.id}
                onClick={() => onPick(g)}
                className="relative rounded-lg overflow-hidden hover:opacity-80 transition aspect-square bg-white/5"
              >
                <img
                  src={g.preview}
                  alt=""
                  loading="lazy"
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}