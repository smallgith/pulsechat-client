/** Download uploaded files across Netlify + Render origins without relying on cross-origin HTML download. */
export async function downloadAttachment(file) {
  if (!file?.url) throw new Error('Attachment is unavailable.');
  const url = new URL(file.url, location.href);
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Invalid attachment URL.');
  const fileName = String(file.name || 'PulseChat-file').replace(/[\/\\]/g, '_').slice(0, 180);
  // Same-origin /api/files/:id — anchor download attribute works reliably here.
  if (/^\/api\/files\/[a-f0-9-]{36}$/.test(url.pathname)) {
    url.searchParams.set('download', '1');
    const anchor = document.createElement('a');
    anchor.href = url.href;
    anchor.rel = 'noopener noreferrer';
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    return;
  }
  // Cross-origin hosted media (Cloudinary etc): CORS fetch is blocked by redirects / no CORS header.
  // Open in a new tab so the browser can download it natively (or user can Save as).
  const anchor = document.createElement('a');
  anchor.href = url.href;
  anchor.rel = 'noopener noreferrer';
  anchor.target = '_blank';
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}
