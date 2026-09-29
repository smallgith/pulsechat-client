/* ============================================================
   Service Worker — Handles notifications + PWA caching
   ============================================================ */

const CACHE = 'pulsechat-v1';

/* ------------ install ------------ */
self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});

/* ------------ notification click ------------ */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      // existing tab focus
      for (const client of list) {
        if (client.url.includes(self.location.origin)) {
          client.focus();
          return client.navigate(urlToOpen);
        }
      }
      // athva navu kholo
      if (clients.openWindow) return clients.openWindow(urlToOpen);
    })
  );
});

/* ------------ push notification (future) ------------ */
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
    })
  );
});