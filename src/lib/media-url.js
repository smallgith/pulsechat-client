export function backendUrl(configured, page = window.location) {
  const url = new URL(configured || `${page.protocol}//${page.hostname}:5000`, page.href);
  if (page.protocol === 'https:' && url.protocol === 'http:') url.protocol = 'https:';
  return url.href.replace(/\/+$/, '');
}

export const API_URL =
  typeof window === 'undefined'
    ? 'http://localhost:5000'
    : backendUrl(import.meta.env?.VITE_SOCKET_URL);

// App-owned file IDs remain valid after fixing an old HTTP/localhost backend setting.
// Resolve them against the current API, including history saved before the HTTPS fix.
export function resolveMediaUrl(value, api = API_URL, pageProtocol = window.location.protocol) {
  if (!value) return '';
  try {
    if (typeof value === 'string' && /^\/api\/files\/[0-9a-f-]{36}$/i.test(value)) return `${api}${value}`;
    const url = new URL(value, `${api}/`);
    const file = url.pathname.match(/\/api\/files\/([a-f0-9-]{36})\/?$/i);
    if (file) {
      const current = new URL(`api/files/${file[1]}`, `${api}/`);
      current.search = url.search;
      return current.href;
    }
    if (pageProtocol === 'https:' && url.protocol === 'http:') url.protocol = 'https:';
    return url.href;
  } catch {
    return '';
  }
}
