import { useEffect, useState } from 'react';
import { Search, Loader2, Sparkles, AlertCircle } from 'lucide-react';
import { isGiphyEnabled, searchGifs } from '../lib/giphy';

export default function GifPicker({ onPick, onClose }) {
  const [q, setQ] = useState('');
  const [gifs, setGifs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isGiphyEnabled()) return;
    let cancel = false;
    setLoading(true);
    setError('');

    const t = setTimeout(async () => {
      try {
        const data = await searchGifs(q);
        if (!cancel) {
          setGifs(data || []);
          if (!data || data.length === 0) {
            setError(q ? 'No GIFs found' : 'No trending GIFs');
          }
          setLoading(false);
        }
      } catch (e) {
        console.error('[gif] search failed', e);
        if (!cancel) {
          setError('Failed to load GIFs');
          setLoading(false);
        }
      }
    }, q.trim() ? 350 : 0);

    return () => {
      cancel = true;
      clearTimeout(t);
    };
  }, [q]);

  /* ---------- Config missing ---------- */
  if (!isGiphyEnabled()) {
    return (
      <>
        <div className="fixed inset-0 bg-black/40 z-20 md:hidden" onClick={onClose} />
        <div className="fixed md:absolute bottom-0 md:bottom-full md:mb-2 left-0 right-0 md:left-3 md:right-auto md:w-[400px] z-30 glass-solid md:rounded-2xl rounded-t-3xl shadow-2xl border-t md:border border-white/15 p-6 text-center animate-pop-in">
          <div className="md:hidden flex justify-center pb-3">
            <div className="w-10 h-1 rounded-full bg-white/20" />
          </div>
          <Sparkles className="w-10 h-10 text-yellow-400 mx-auto mb-3" />
          <p className="text-sm font-medium mb-2">GIPHY not configured</p>
          <p className="text-xs text-slate-400 leading-relaxed mb-3">
            Get a free API key at{' '}
            <a
              href="https://developers.giphy.com/dashboard/"
              target="_blank"
              rel="noreferrer"
              className="text-brand-400 hover:underline"
            >
              developers.giphy.com
            </a>
          </p>
          <p className="text-[11px] text-slate-500">
            Add <code className="text-brand-400">VITE_GIPHY_API_KEY</code> in Netlify env vars,
            then redeploy
          </p>
          <button
            onClick={onClose}
            className="mt-4 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs"
          >
            Close
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-20 md:hidden" onClick={onClose} />

      <div className="fixed md:absolute bottom-0 md:bottom-full md:mb-2 left-0 right-0 md:left-3 md:right-auto md:w-[400px] z-30 glass-solid md:rounded-2xl rounded-t-3xl shadow-2xl border-t md:border border-white/15 overflow-hidden animate-pop-in max-h-[75vh] md:max-h-none flex flex-col">
        <div className="md:hidden flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        <div className="p-3 border-b border-white/10">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search GIFs…"
              className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-ink-900/80 border border-white/10 text-sm outline-none focus:border-brand-500/40"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scroll-thin p-2 pb-4 min-h-0 md:max-h-80">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-5 h-5 animate-spin text-brand-400" />
            </div>
          ) : error && gifs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <AlertCircle className="w-6 h-6 text-slate-500" />
              <p className="text-xs text-slate-500">{error}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {gifs.map((g) => (
                <button
                  key={g.id}
                  onClick={() => onPick(g)}
                  className="relative rounded-lg overflow-hidden hover:opacity-80 active:opacity-60 transition aspect-square bg-white/5"
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
    </>
  );
}