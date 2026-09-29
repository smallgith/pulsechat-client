const API_KEY = import.meta.env.VITE_GIPHY_API_KEY || '';
const BASE = 'https://api.giphy.com/v1/gifs';

export const isGiphyEnabled = () => !!API_KEY;

export const searchGifs = async (q = '', limit = 24) => {
  if (!API_KEY) return [];
  const endpoint = q.trim() ? 'search' : 'trending';
  const url = `${BASE}/${endpoint}?api_key=${API_KEY}&limit=${limit}&rating=pg-13${
    q.trim() ? `&q=${encodeURIComponent(q.trim())}` : ''
  }`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const json = await res.json();
  return (json.data || []).map((g) => ({
    id: g.id,
    url: g.images.fixed_height.url,
    preview: g.images.fixed_height_small?.url || g.images.fixed_height.url,
    width: Number(g.images.fixed_height.width),
    height: Number(g.images.fixed_height.height),
  }));
};