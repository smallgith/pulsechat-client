/* ============================================================
   Service Worker — Mobile/Desktop notifications
   ============================================================ */

const CACHE_NAME = 'pulsechat-v2';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))
      )
    )
  );
  self.clients.claim();
});

/* ---------- notification click ---------- */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.startsWith(self.location.origin) && 'focus' in client) {
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(urlToOpen);
        }
      })
  );
});

/* ---------- push (future) ---------- */
self.addEventListener('push', (event) => {
  let data = { title: 'PulseChat', body: 'New message' };
  try {
    if (event.data) data = event.data.json();
  } catch {}
  event.waitUntil(
    self.registration.showNotification(data.title || 'PulseChat', {
      body: data.body || '',
      icon: data.icon || '/favicon.ico',
      badge: '/favicon.ico',
      tag: data.tag || 'pulsechat',
      data: { url: data.url || '/' },
      vibrate: [200, 100, 200],
      requireInteraction: false,
    })
  );
});

/* ---------- offline fallback ---------- */
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  // Don't intercept API
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/socket.io')) return;
});