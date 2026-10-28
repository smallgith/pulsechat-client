import { io } from 'socket.io-client';

export const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL || `${window.location.protocol}//${window.location.hostname}:5000`;

export const createSocket = () =>
  io(SOCKET_URL, {
    transports: ['websocket', 'polling'],
    reconnectionAttempts: 10,
    reconnectionDelay: 800,
  });

export const roomId = (a, b) => b?.startsWith('group:') ? b : [a, b].sort().join('::');

export const authHeaders = () => {
  try { return { Authorization: `Bearer ${JSON.parse(localStorage.getItem('pulsechat.user') || '{}').token || ''}` }; }
  catch { return {}; }
};

export const uploadFile = (file, onProgress = () => {}) =>
  new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${SOCKET_URL}/api/upload`);
    Object.entries(authHeaders()).forEach(([key, value]) => xhr.setRequestHeader(key, value));
    xhr.timeout = 120000;
    xhr.ontimeout = () => reject(new Error('Upload timed out. Try again.'));
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch {
          reject(new Error('Bad response'));
        }
      } else reject(new Error('Upload failed'));
    };
    xhr.onerror = () => reject(new Error('Upload failed'));
    const fd = new FormData();
    fd.append('file', file);
    xhr.send(fd);
  });
