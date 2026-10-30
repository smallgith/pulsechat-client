import { SOCKET_URL } from './socket';

const localFile = /\/api\/files\/[a-f0-9-]{36}\/?$/i;
const missingFile = 'This file is no longer available. Ask the sender to upload it again.';

function saveUrl(url, name) {
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.target = '_self';
  anchor.referrerPolicy = 'no-referrer';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

async function checkDownload(url) {
  const response = await fetch(url, { method: 'HEAD' });
  if (!response.ok) {
    if (response.status === 404 || response.status === 410) throw new Error(missingFile);
    throw new Error(`Could not download this file (${response.status}). Please try again.`);
  }
  if (!/^attachment\b/i.test(response.headers.get('content-disposition') || ''))
    throw new Error('The server did not return a download. Update and restart the chat server.');
}

/** Local/Cloudinary downloads stream to disk; other hosted media uses a same-origin blob. */
export async function downloadAttachment(file) {
  if (!file?.url) throw new Error('Attachment is unavailable.');
  const api = `${SOCKET_URL.replace(/\/+$/, '')}/`;
  let url;
  try {
    url = new URL(file.url, api);
  } catch {
    throw new Error('Invalid attachment URL.');
  }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password)
    throw new Error('Invalid attachment URL.');
  const fallback = file.mime?.startsWith('audio/') ? 'voice-message.webm' : 'PulseChat-file';
  const name = String(file.name || fallback)
    .replace(/[\\/<>:"|?*\u0000-\u001f\u007f]/g, '_')
    .slice(0, 180);

  if (localFile.test(url.pathname)) {
    url.pathname = url.pathname.replace(/\/{2,}/g, '/').replace(/\/$/, '');
    url.searchParams.set('download', '1');
    try {
      await checkDownload(url.href);
    } catch (error) {
      if (error instanceof TypeError)
        throw new Error('Cannot reach the file server. Check your connection and try again.');
      throw error;
    }
    saveUrl(url.href, name);
    return;
  }

  if (url.hostname === 'res.cloudinary.com') {
    // Supply Content-Disposition even when CDN CORS is blocked; stream large files to disk.
    const download = new URL('api/download', api);
    download.searchParams.set('url', url.href);
    download.searchParams.set('name', name);
    await checkDownload(download.href);
    saveUrl(download.href, name);
    return;
  }

  let response;
  try {
    response = await fetch(url.href, { credentials: 'omit' });
  } catch {
    throw new Error(
      'This host does not allow file downloads. Ask the sender to upload the file directly in chat.'
    );
  }
  if (!response.ok) {
    if (response.status === 404 || response.status === 410) throw new Error(missingFile);
    throw new Error(`Could not download this file (${response.status}). Please try again.`);
  }
  const blobUrl = URL.createObjectURL(await response.blob());
  saveUrl(blobUrl, name);
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
}
