import { authHeaders, SOCKET_URL } from './socket';

export async function enablePush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !window.isSecureContext) return false;
  const registration = await navigator.serviceWorker.register('/sw.js');
  // Do not wait forever if a worker cannot activate.
  await Promise.race([navigator.serviceWorker.ready, new Promise((_, reject) => setTimeout(() => reject(new Error('Notification service could not start')), 8000))]);
  const res = await fetch(`${SOCKET_URL}/api/push/key`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Could not enable background notifications. Sign in again.');
  const { publicKey } = await res.json();
  const bytes = Uint8Array.from(atob(publicKey.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes });
  const response = await fetch(`${SOCKET_URL}/api/push/subscribe`, { method: 'POST', headers: { ...authHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify(subscription) });
  if (!response.ok) throw new Error('Could not save background notification settings.');
  return true;
}
