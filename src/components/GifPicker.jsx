import { useEffect, useRef, useState } from 'react';
import { Search, Loader2, Upload, X, Link2 } from 'lucide-react';
import { isGiphyEnabled, searchGifs } from '../lib/giphy';

export default function GifPicker({ onPick, onClose, onUpload }) {
  const [query, setQuery] = useState(''),
    [gifs, setGifs] = useState([]),
    [loading, setLoading] = useState(false),
    [error, setError] = useState('');
  const [url, setUrl] = useState(''),
    [preview, setPreview] = useState(''),
    [loaded, setLoaded] = useState(false);
  const input = useRef();
  const account = (() => {
    try {
      return JSON.parse(localStorage.getItem('pulsechat.user') || '{}').phone || '';
    } catch {
      return '';
    }
  })();
  const key = `pulsechat.gif-recents.${account}`;
  const [recent, setRecent] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(key) || '[]');
    } catch {
      return [];
    }
  });
  const pick = (gif) => {
    const next = [gif, ...recent.filter((g) => g.url !== gif.url)].slice(0, 20);
    localStorage.setItem(key, JSON.stringify(next));
    setRecent(next);
    onPick(gif);
  };
  useEffect(() => {
    if (!isGiphyEnabled()) return;
    let active = true;
    setLoading(true);
    setError('');
    const timer = setTimeout(
      () =>
        searchGifs(query)
          .then((data) => {
            if (active) setGifs(data);
          })
          .catch(() => {
            if (active)
              setError(
                'Search is unavailable. You can still upload a GIF or paste its image link.'
              );
          })
          .finally(() => {
            if (active) setLoading(false);
          }),
      300
    );
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query]);
  return (
    <div className="gif-pane">
      <header>
        <div>
          <strong>A little more expression.</strong>
          <small>GIFs, your way</small>
        </div>
        <button className="icon-btn" aria-label="Close GIF picker" onClick={onClose}>
          <X size={17} />
        </button>
      </header>
      <input
        type="file"
        ref={input}
        hidden
        accept="image/gif"
        onChange={(e) => {
          if (e.target.files[0]) onUpload(e.target.files[0]);
        }}
      />
      <button className="btn-secondary w-full" onClick={() => input.current.click()}>
        <Upload size={15} />
        Upload your GIF
      </button>
      <form
        className="flex gap-2 mt-3"
        onSubmit={(e) => {
          e.preventDefault();
          try {
            const link = new URL(url);
            if (!['https:', 'http:'].includes(link.protocol)) throw new Error();
            setPreview(link.href);
            setLoaded(false);
            setError('');
          } catch {
            setError('Paste an http or https image link.');
          }
        }}
      >
        <input
          className="field !text-xs"
          placeholder="Paste a GIF image link"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <button className="btn-secondary" aria-label="Preview GIF link">
          <Link2 size={16} />
        </button>
      </form>
      {preview && (
        <div className="mt-3 p-2 rounded-xl bg-white/5">
          <img
            src={preview}
            alt="GIF preview"
            className="max-h-40 mx-auto rounded-lg"
            onLoad={() => setLoaded(true)}
            onError={() => {
              setError('That link could not load an image. Try a direct GIF image URL.');
              setLoaded(false);
            }}
          />
          <button
            className="btn-primary w-full mt-2"
            disabled={!loaded}
            onClick={() => pick({ url: preview, preview })}
          >
            Send GIF
          </button>
        </div>
      )}
      {isGiphyEnabled() && (
        <div className="relative mt-4">
          <Search size={15} className="absolute left-3 top-3 text-slate-400" />
          <input
            className="field !pl-9 !text-xs"
            placeholder="Search GIFs via GIPHY"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      )}
      {error && <p className="text-xs text-red-400 mt-3">{error}</p>}
      {loading ? (
        <Loader2 size={22} className="animate-spin mx-auto my-8 text-brand-400" />
      ) : (
        <div className="gif-grid">
          {(isGiphyEnabled() ? gifs : recent).map((g, i) => (
            <button
              key={g.id || `${g.url}-${i}`}
              aria-label={`Send GIF ${i + 1}`}
              onClick={() => pick(g)}
            >
              <img src={g.preview || g.url} loading="lazy" alt="GIF" />
            </button>
          ))}
        </div>
      )}
      {!isGiphyEnabled() && recent.length === 0 && (
        <p className="empty-hint !p-3">
          Upload a favourite GIF or paste an image link. Your recently sent GIFs appear here.
        </p>
      )}
      {isGiphyEnabled() && (
        <p className="text-[9px] text-slate-500 text-right mt-2">Powered by GIPHY</p>
      )}
    </div>
  );
}
