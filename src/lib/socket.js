import { io } from 'socket.io-client';

export const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ||
  `${window.location.protocol}//${window.location.hostname}:5000`;

export const createSocket = () =>
  io(SOCKET_URL, {
    transports: ['websocket', 'polling'],
    reconnectionAttempts: 10,
    reconnectionDelay: 800,
  });

export const roomId = (a, b) => (b?.startsWith('group:') ? b : [a, b].sort().join('::'));

export const authHeaders = () => {
  try {
    return {
      Authorization: `Bearer ${JSON.parse(localStorage.getItem('pulsechat.user') || '{}').token || ''}`,
    };
  } catch {
    return {};
  }
};

export class TransferControl {
  constructor() {
    this.paused = false;
    this.cancelled = false;
    this.xhr = null;
    this.waiters = [];
  }
  pause() {
    this.paused = true;
    this.xhr?.abort();
  }
  resume() {
    this.paused = false;
    this.waiters.splice(0).forEach((resolve) => resolve());
  }
  cancel() {
    this.cancelled = true;
    this.xhr?.abort();
    this.resume();
  }
  async wait() {
    if (this.paused) await new Promise((resolve) => this.waiters.push(resolve));
    if (this.cancelled) throw Object.assign(new Error('Transfer cancelled'), { cancelled: true });
  }
}
const digest = async (bytes) => {
  if (!crypto.subtle) throw new Error('Secure uploads require HTTPS or localhost.');
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
};
const transferRequest = (method, route, body, control, extra = {}, onProgress) =>
  new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    control.xhr = xhr;
    xhr.open(method, `${SOCKET_URL}${route}`);
    xhr.timeout = 120000;
    for (const [key, value] of Object.entries({ ...authHeaders(), ...extra }))
      xhr.setRequestHeader(key, value);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(e.loaded);
    };
    xhr.onload = () => {
      let data;
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        data = {};
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data);
      else
        reject(
          Object.assign(new Error(data.error || `Upload failed (${xhr.status})`), {
            status: xhr.status,
            data,
          })
        );
    };
    xhr.onerror = () => reject(new Error('Connection interrupted. You can resume this file.'));
    xhr.ontimeout = () => reject(new Error('Connection timed out. You can resume this file.'));
    xhr.onabort = () => reject(Object.assign(new Error('Transfer paused'), { paused: true }));
    xhr.send(body);
  });
export async function uploadFile(
  file,
  onProgress = () => {},
  control = new TransferControl(),
  onState = () => {}
) {
  const sampleA = new Uint8Array(await file.slice(0, 65536).arrayBuffer());
  const sampleB = new Uint8Array(await file.slice(Math.max(0, file.size - 65536)).arrayBuffer());
  const sample = new Uint8Array(sampleA.length + sampleB.length);
  sample.set(sampleA);
  sample.set(sampleB, sampleA.length);
  const fingerprint = `${file.size}:${file.lastModified || 0}:${await digest(sample)}`;
  let meta;
  const send = (method, route, body, headers, progress) =>
    transferRequest(method, route, body, control, headers, progress);
  const retry = async (action) => {
    let attempts = 0;
    while (true) {
      await control.wait();
      try {
        return await action();
      } catch (error) {
        if (control.cancelled)
          throw Object.assign(new Error('Transfer cancelled'), { cancelled: true });
        if (control.paused || error.paused) {
          onState('paused');
          await control.wait();
          onState('uploading');
          continue;
        }
        if (error.status && error.status !== 409 && error.status < 500) throw error;
        if (++attempts > 3) throw error;
        onState('retrying');
        await new Promise((r) => setTimeout(r, attempts * 700));
        onState('uploading');
      }
    }
  };
  await control.wait();
  onState('uploading');
  meta = await retry(() =>
    send(
      'POST',
      '/api/uploads',
      JSON.stringify({
        name: file.name || 'Voice message',
        mime: file.type,
        size: file.size,
        fingerprint,
      }),
      { 'Content-Type': 'application/json' }
    )
  );
  control.uploadId = meta.id;
  if (meta.file) {
    onProgress(100);
    return meta.file;
  }
  let offset = meta.offset;
  while (offset < file.size) {
    await control.wait();
    const chunk = await file
      .slice(offset, Math.min(file.size, offset + meta.chunkSize))
      .arrayBuffer();
    const checksum = await digest(chunk);
    const start = offset;
    let first = true;
    const response = await retry(async () => {
      if (!first) {
        const current = await send('GET', `/api/uploads/${meta.id}`);
        if (current.offset !== start) return current;
      }
      first = false;
      return send(
        'PATCH',
        `/api/uploads/${meta.id}`,
        chunk,
        {
          'Content-Type': 'application/octet-stream',
          'Upload-Offset': String(start),
          'Upload-Checksum': checksum,
        },
        (loaded) => onProgress(Math.min(99, Math.round(((start + loaded) / file.size) * 100)))
      );
    });
    if (
      !Number.isSafeInteger(response.offset) ||
      response.offset < 0 ||
      response.offset > file.size
    )
      throw new Error('Invalid transfer offset');
    offset = response.offset;
    onProgress(Math.min(99, Math.round((offset / file.size) * 100)));
  }
  const result = await retry(() =>
    send('POST', `/api/uploads/${meta.id}/complete`, '{}', { 'Content-Type': 'application/json' })
  );
  onProgress(100);
  onState('uploaded');
  return result;
}

export async function discardTransfer(control) {
  control.cancel();
  if (control.uploadId) {
    try {
      await fetch(`${SOCKET_URL}/api/uploads/${control.uploadId}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
    } catch {
      /* Abandoned partial files expire after seven days. */
    }
  }
}
