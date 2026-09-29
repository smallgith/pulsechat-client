import { io } from 'socket.io-client';

export const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

export const createSocket = () =>
  io(SOCKET_URL, {
    transports: ['websocket', 'polling'],
    reconnectionAttempts: 10,
    reconnectionDelay: 800,
  });

export const roomId = (a, b) => [a, b].sort().join('::');

export const uploadFile = (file, onProgress = () => {}) =>
  new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${SOCKET_URL}/api/upload`);
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