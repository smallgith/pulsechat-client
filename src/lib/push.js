import { authHeaders, SOCKET_URL } from './socket';

let pushEnabled = false;
let enabling,
  generation = 0,
  disabledToken;
export const isPushEnabled = () => pushEnabled;
const account = () => {
  try {
    return JSON.parse(localStorage.getItem('pulsechat.user') || '{}');
  } catch {
    return {};
  }
};
async function registration() {
  if (!('serviceWorker' in navigator) || !window.isSecureContext) return null;
  await navigator.serviceWorker.register('/sw.js');
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Notification service could not start')), 8000)
    ),
  ]);
}
async function workerRequest(data, reg) {
  const current = reg || (await navigator.serviceWorker.getRegistration());
  if (!current?.active) return null;
  return new Promise((resolve, reject) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => {
      channel.port1.close();
      reject(new Error('Notification service did not respond.'));
    }, 5000);
    channel.port1.onmessage = ({ data }) => {
      clearTimeout(timer);
      channel.port1.close();
      resolve(data);
    };
    current.active.postMessage(data, [channel.port2]);
  });
}
export async function syncNotificationAccount() {
  const epoch = generation;
  const user = account();
  if (!user.token || user.token === disabledToken) return;
  const reg = await registration();
  if (!reg || epoch !== generation) return;
  await workerRequest(
    {
      type: 'NOTIFICATION_ACCOUNT',
      user: user.phone,
      apiUrl: SOCKET_URL,
      privateMode: !!localStorage.getItem(`pulsechat.lock.${user.phone}`),
    },
    reg
  );
}
export async function clearNotificationAccount() {
  generation++;
  disabledToken = account().token;
  pushEnabled = false;
  if ('serviceWorker' in navigator)
    await workerRequest({ type: 'CLEAR_NOTIFICATIONS' }).catch(() => {});
}
export async function readNotificationDraft(id) {
  const result = await workerRequest({ type: 'READ_NOTIFICATION_DRAFT', id });
  return result?.draft;
}
export async function notificationReplyContext(chat, messageId) {
  const response = await fetch(`${SOCKET_URL}/api/notifications/context`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat, messageId }),
  });
  if (!response.ok) return null;
  return (await response.json()).reply;
}
async function setupPush() {
  const epoch = generation;
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !window.isSecureContext)
    return false;
  pushEnabled = false;
  const reg = await registration();
  await syncNotificationAccount();
  if (epoch !== generation || account().token === disabledToken) return false;
  const res = await fetch(`${SOCKET_URL}/api/push/key`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Could not enable background notifications. Sign in again.');
  const { publicKey } = await res.json();
  const bytes = Uint8Array.from(atob(publicKey.replace(/-/g, '+').replace(/_/g, '/')), (c) =>
    c.charCodeAt(0)
  );
  let subscription = await reg.pushManager.getSubscription();
  const existingKey = subscription?.options?.applicationServerKey;
  if (subscription && existingKey) {
    const previous = new Uint8Array(existingKey);
    if (previous.length !== bytes.length || previous.some((byte, index) => byte !== bytes[index])) {
      await subscription.unsubscribe();
      subscription = null;
    }
  }
  if (!subscription)
    subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: bytes,
    });
  const user = account();
  const response = await fetch(`${SOCKET_URL}/api/push/subscribe`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...subscription.toJSON(),
      privateMode: !!localStorage.getItem(`pulsechat.lock.${user.phone}`),
    }),
  });
  if (!response.ok) throw new Error('Could not save background notification settings.');
  if (epoch !== generation) return false;
  pushEnabled = true;
  return true;
}
export function enablePush() {
  if (!enabling)
    enabling = setupPush().finally(() => {
      enabling = null;
    });
  return enabling;
}
