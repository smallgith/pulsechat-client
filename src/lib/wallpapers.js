// Wallpaper images remain on this device in IndexedDB; never put multi-MB photos in localStorage.
const DB = 'pulsechat-wallpapers-v1';
const STORE = 'wallpapers';
const open = () => new Promise((resolve, reject) => {
  const request = indexedDB.open(DB, 1);
  request.onupgradeneeded = () => request.result.createObjectStore(STORE);
  request.onerror = () => reject(request.error);
  request.onsuccess = () => resolve(request.result);
});
const run = async (key, kind, value) => {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, kind === 'get' ? 'readonly' : 'readwrite');
    const store = tx.objectStore(STORE);
    const req = kind === 'get' ? store.get(key) : kind === 'put' ? store.put(value, key) : store.delete(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
};
export const wallpaperKey = (account, chat) => `wallpaper:${account}:${chat || 'global'}`;
export const getWallpaper = key => run(key, 'get');
export const putWallpaper = async (key, file) => {
  if (!file?.type?.startsWith('image/') || file.size > 8 * 1024 * 1024) throw new Error('Choose a JPG/PNG/WebP wallpaper under 8 MB');
  await run(key, 'put', file);
  window.dispatchEvent(new CustomEvent('pulsechat:wallpaper', { detail: key }));
};
export const deleteWallpaper = async key => { await run(key, 'delete'); window.dispatchEvent(new CustomEvent('pulsechat:wallpaper', { detail: key })); };
