/* Background notifications and PWA launch handling. No private messages cached. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/', self.location.origin);
  if (target.origin !== self.location.origin) return;
  if (event.action === 'reply') target.searchParams.set('reply', '1');
  // A website cannot directly start a microphone/camera call from a closed service worker.
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const client = windows.find((w) => new URL(w.url).origin === self.location.origin);
    if (client) {
      client.postMessage({
        type: 'OPEN_CHAT', chat: target.searchParams.get('chat'),
        reply: target.searchParams.get('reply') === '1',
      });
      await client.focus();
      return;
    }
    await self.clients.openWindow(target.href);
  })());
});
self.addEventListener('push', (event) => {
  let data;
  try { data = event.data?.json(); } catch { return; }
  if (!data) return;
  const call = data.type === 'call';
  event.waitUntil(self.registration.showNotification(data.title || 'PulseChat', {
    body: data.body || 'New message',
    icon: typeof data.icon === 'string' && /^https:\/\//.test(data.icon) ? data.icon : '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.tag || 'pulsechat', renotify: true, silent: false,
    data: { url: data.url || '/' },
    requireInteraction: call,
    vibrate: call ? [250, 120, 250, 120, 400] : [150],
    actions: call ? [{ action: 'open', title: 'Open call' }]
      : [{ action: 'reply', title: 'Reply in app' }, { action: 'open', title: 'Open' }],
  }));
});
