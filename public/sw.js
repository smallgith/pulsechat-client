/* Notification replies use short-lived, chat-scoped capabilities, never a login token. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

const database = () =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open('pulsechat-notifications', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('state');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
async function state(action, key, value) {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('state', action === 'get' ? 'readonly' : 'readwrite');
      const store = tx.objectStore('state');
      const request =
        action === 'get'
          ? store.get(key)
          : action === 'set'
            ? store.put(value, key)
            : action === 'delete'
              ? store.delete(key)
              : store.clear();
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
self.addEventListener('message', (event) => {
  if (!event.source?.url || new URL(event.source.url).origin !== self.location.origin) return;
  event.waitUntil(
    (async () => {
      try {
        if (event.data?.type === 'NOTIFICATION_ACCOUNT') {
          const old = await state('get', 'account');
          if (old?.user && old.user !== event.data.user) await state('clear');
          await state('set', 'account', {
            user: event.data.user,
            apiUrl: event.data.apiUrl,
            privateMode: !!event.data.privateMode,
          });
        } else if (event.data?.type === 'CLEAR_NOTIFICATIONS') {
          await state('clear');
          for (const notification of await self.registration.getNotifications())
            notification.close();
        } else if (event.data?.type === 'READ_NOTIFICATION_DRAFT') {
          const account = await state('get', 'account');
          const draft = await state('get', `draft:${event.data.id}`);
          event.ports[0]?.postMessage({
            ok: true,
            draft: draft?.user === account?.user ? draft : null,
          });
          return;
        }
        event.ports[0]?.postMessage({ ok: true });
      } catch {
        event.ports[0]?.postMessage({ ok: false });
      }
    })()
  );
});
const replyActions = () => [
  { action: 'reply', type: 'text', title: 'Reply', placeholder: 'Type a reply…' },
  { action: 'open', title: 'Open chat' },
];
const accountState = () => state('get', 'account').catch(() => null);
async function openReply(data, draftId, error) {
  const target = new URL(data.url || '/', self.location.origin);
  if (target.origin !== self.location.origin) return;
  target.searchParams.set('reply', '1');
  if (data.messageId) target.searchParams.set('replyTo', data.messageId);
  if (draftId) target.searchParams.set('notificationDraft', draftId);
  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  const client = windows.find((window) => new URL(window.url).origin === self.location.origin);
  if (client) {
    client.postMessage({
      type: 'OPEN_QUICK_REPLY',
      chat: data.chat || target.searchParams.get('chat'),
      user: data.user,
      messageId: data.messageId,
      draftId,
      error,
    });
    await client.focus();
  } else await self.clients.openWindow(target.href);
}
async function sendReply(data, text) {
  const account = await accountState();
  if (!account || account.user !== data.user || account.privateMode || data.privateMode)
    throw new Error('Open and unlock the app to reply.');
  const endpoint = new URL('api/notifications/reply', `${account.apiUrl.replace(/\/+$/, '')}/`);
  if (!data.reply?.token || !['https:', 'http:'].includes(endpoint.protocol))
    throw new Error('Open the app to reply to this notification.');
  const response = await fetch(endpoint.href, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'omit',
    body: JSON.stringify({ token: data.reply.token, text }),
    signal: AbortSignal.timeout(15000),
  });
  const result = await response.json();
  if (!response.ok || !result.ok) throw new Error(result.error || 'Reply was not sent.');
}
self.addEventListener('notificationclick', (event) => {
  const data = event.notification.data || {};
  event.notification.close();
  event.waitUntil(
    (async () => {
      const text = event.action === 'retry' ? data.pendingReply : event.reply;
      if (
        (event.action === 'reply' || event.action === 'retry') &&
        typeof text === 'string' &&
        text.trim()
      ) {
        const draftId = data.draftId || crypto.randomUUID();
        try {
          await sendReply(data, text.trim());
          await state('delete', `draft:${draftId}`).catch(() => {});
          await self.registration.showNotification('Reply sent', {
            body: 'Your message was sent.',
            tag: `reply-${draftId}`,
            silent: true,
            icon: '/icon-192.png',
            data: { url: data.url },
          });
        } catch (error) {
          await state('set', `draft:${draftId}`, {
            user: data.user,
            text,
            chat: data.chat,
            messageId: data.messageId,
            clientId: data.reply?.clientId,
            error: error.message,
          }).catch(() => {});
          await self.registration.showNotification('Reply not sent', {
            body: 'Your reply is saved. Retry or open the chat to send it.',
            icon: '/icon-192.png',
            tag: `reply-${draftId}`,
            requireInteraction: true,
            data: { ...data, draftId, pendingReply: text },
            actions: [
              { action: 'retry', title: 'Retry' },
              { action: 'open', title: 'Open chat' },
            ],
          });
        }
        return;
      }
      if (event.action === 'reply' || data.draftId) {
        await openReply(data, data.draftId);
        return;
      }
      const target = new URL(data.url || '/', self.location.origin);
      if (target.origin !== self.location.origin) return;
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const client = windows.find((window) => new URL(window.url).origin === self.location.origin);
      if (client) {
        client.postMessage({ type: 'OPEN_CHAT', chat: target.searchParams.get('chat') });
        await client.focus();
      } else await self.clients.openWindow(target.href);
    })()
  );
});
self.addEventListener('push', (event) => {
  let data;
  try {
    data = event.data?.json();
  } catch {
    return;
  }
  if (!data) return;
  event.waitUntil(
    (async () => {
      const account = await accountState();
      if (account?.user && data.user && account.user !== data.user) return;
      const privateMode = data.privateMode || account?.privateMode || !account;
      const call = data.type === 'call';
      const existing = await self.registration.getNotifications({ tag: data.tag || 'pulsechat' });
      if (
        data.messageId &&
        existing.some((notification) => notification.data?.messageId === data.messageId)
      )
        return;
      const notificationData = {
        url: data.url || '/',
        chat: data.chat,
        user: data.user,
        messageId: data.messageId,
        reply: privateMode ? null : data.reply,
        privateMode,
      };
      const options = {
        body: privateMode
          ? call
            ? 'Incoming call · Open PulseChat'
            : 'New message · Open PulseChat'
          : data.body || 'New message',
        icon:
          !privateMode && typeof data.icon === 'string' && /^https:\/\//.test(data.icon)
            ? data.icon
            : '/icon-192.png',
        badge: '/icon-192.png',
        ...(!privateMode && typeof data.image === 'string' && /^https:\/\//.test(data.image) ? { image: data.image } : {}),
        tag: data.tag || 'pulsechat',
        renotify: true,
        silent: false,
        timestamp: Date.now(),
        data: notificationData,
        requireInteraction: call || !!notificationData.reply,
        actions: call
          ? [{ action: 'open', title: 'Open call' }]
          : notificationData.reply
            ? replyActions()
            : [{ action: 'open', title: 'Open chat' }],
      };
      try {
        await self.registration.showNotification(
          privateMode ? 'PulseChat' : data.title || 'PulseChat',
          options
        );
      } catch {
        await self.registration.showNotification('PulseChat', { ...options, actions: [] });
      }
    })()
  );
});
