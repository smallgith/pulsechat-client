/** Download uploaded files across Netlify + Render origins without relying on cross-origin HTML download. */
export async function downloadAttachment(file) {
  if (!file?.url) throw new Error('Attachment is unavailable.');
  const url = new URL(file.url, location.href);
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Invalid attachment URL.');
  // Our Node server streams files with a real attachment Content-Disposition header.
  if (/^\/api\/files\/[a-f0-9-]{36}$/.test(url.pathname)) {
    url.searchParams.set('download', '1');
    const anchor = document.createElement('a');
    anchor.href = url.href; anchor.rel = 'noopener noreferrer'; anchor.target = '_blank';
    document.body.appendChild(anchor); anchor.click(); anchor.remove();
    return;
  }
  // Download small hosted media using a blob URL (remote download attribute is ignored by Chrome).
  if (Number(file.size || 0) > 80 * 1024 * 1024) {
    window.open(url.href, '_blank', 'noopener,noreferrer');
    return;
  }
  let response;
  try { response = await fetch(url.href, { mode: 'cors', credentials: 'omit' }); }
  catch { throw new Error('Provider blocked file download. Open the media and use Save as.'); }
  if (!response.ok) throw new Error(`File is unavailable (${response.status}).`);
  const blob = await response.blob();
  const blobUrl = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a'); a.href = blobUrl;
    a.download = String(file.name || 'PulseChat-file').replace(/[\/\\]/g, '_').slice(0, 180);
    document.body.appendChild(a); a.click(); a.remove();
  } finally { setTimeout(() => URL.revokeObjectURL(blobUrl), 30000); }
}
