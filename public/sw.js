self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/', self.location.origin);
  if (target.origin !== self.location.origin) return;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const client = windows.find((w) => new URL(w.url).origin === self.location.origin);
    if (client) { client.postMessage({ type: 'OPEN_CHAT', chat: target.searchParams.get('chat') }); return client.focus(); }
    return self.clients.openWindow(target.href);
  })());
});
self.addEventListener('push', (event) => {
  let data;
  try { data = event.data?.json(); } catch { return; }
  if (!data) return;
  event.waitUntil(self.registration.showNotification(data.title || 'PulseChat', {
    body: data.body || 'New message', icon: '/icon.svg', badge: '/icon.svg',
    tag: data.tag || 'pulsechat', data: { url: data.url || '/' },
  }));
});
