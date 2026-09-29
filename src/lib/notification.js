/* ============================================================
   Notifications — sound + browser + tab badge
   ============================================================ */

const SOUND_URL = '/notification.mp3';
const BASE_TITLE = 'PulseChat';
const FAVICON_ID = 'pulsechat-favicon';

/* ==================== AUDIO ==================== */
let audioCtx = null;
let audioBuffer = null;
let unlocked = false;

const ensureCtx = () => {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
};

export const unlockAudio = async () => {
  try {
    const ctx = ensureCtx();
    if (ctx.state === 'suspended') await ctx.resume();

    // silent beep
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    gain.gain.value = 0.0001;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(0);
    osc.stop(0.01);

    unlocked = true;

    // preload mp3
    loadSound().catch(() => {});
    return true;
  } catch (e) {
    console.warn('[audio] unlock failed', e);
    return false;
  }
};

const loadSound = async () => {
  if (audioBuffer) return audioBuffer;
  try {
    const ctx = ensureCtx();
    const res = await fetch(SOUND_URL);
    if (!res.ok) throw new Error('sound 404');
    const buf = await res.arrayBuffer();
    audioBuffer = await ctx.decodeAudioData(buf);
    console.log('[audio] sound loaded ✓');
    return audioBuffer;
  } catch (e) {
    console.warn('[audio] load failed', e);
    return null;
  }
};

export const playSound = async () => {
  try {
    const ctx = ensureCtx();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    const buf = await loadSound();

    if (buf) {
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const gain = ctx.createGain();
      gain.gain.value = 0.7;
      src.connect(gain);
      gain.connect(ctx.destination);
      src.start(0);
      return;
    }

    // fallback synth ding
    const now = ctx.currentTime;

    const o1 = ctx.createOscillator();
    const g1 = ctx.createGain();
    o1.type = 'sine';
    o1.frequency.setValueAtTime(880, now);
    o1.frequency.exponentialRampToValueAtTime(1320, now + 0.08);
    g1.gain.setValueAtTime(0.0001, now);
    g1.gain.exponentialRampToValueAtTime(0.4, now + 0.015);
    g1.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
    o1.connect(g1);
    g1.connect(ctx.destination);
    o1.start(now);
    o1.stop(now + 0.3);

    const o2 = ctx.createOscillator();
    const g2 = ctx.createGain();
    o2.type = 'sine';
    o2.frequency.setValueAtTime(1175, now + 0.12);
    g2.gain.setValueAtTime(0.0001, now + 0.12);
    g2.gain.exponentialRampToValueAtTime(0.35, now + 0.14);
    g2.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
    o2.connect(g2);
    g2.connect(ctx.destination);
    o2.start(now + 0.12);
    o2.stop(now + 0.45);
  } catch (e) {
    console.warn('[audio] play failed', e);
  }
};

/* ==================== BROWSER NOTIFICATIONS ==================== */
export const getPermission = () =>
  typeof Notification !== 'undefined' ? Notification.permission : 'unsupported';

export const requestPermission = async () => {
  if (typeof Notification === 'undefined') return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  try {
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
};

export const showBrowserNotification = async ({
  title,
  body,
  icon,
  tag,
  onClick,
  force = false,
} = {}) => {
  console.log('[notif] called', { title, body, force, permission: Notification?.permission });

  if (typeof Notification === 'undefined') {
    console.warn('[notif] Notification API not supported');
    return null;
  }
  if (Notification.permission !== 'granted') {
    console.warn('[notif] permission not granted:', Notification.permission);
    return null;
  }

  if (!force && document.visibilityState === 'visible' && document.hasFocus()) {
    console.log('[notif] skipped — tab focused');
    return null;
  }

  const opts = {
    body: body || '',
    icon: icon || '/favicon.ico',
    badge: '/favicon.ico',
    tag: tag || 'pulsechat',
    renotify: true,
    silent: true,
    vibrate: [200, 100, 200],
    data: { url: '/' },
  };

  try {
    // Prefer SW
    if ('serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.ready;
        if (reg?.showNotification) {
          await reg.showNotification(title || 'PulseChat', opts);
          console.log('[notif] shown via SW');
          return true;
        }
      } catch (e) {
        console.warn('[notif] SW failed, fallback:', e);
      }
    }

    const n = new Notification(title || 'PulseChat', opts);
    console.log('[notif] shown via direct API');
    n.onclick = () => {
      window.focus();
      n.close();
      onClick?.();
    };
    setTimeout(() => n.close(), 8000);
    return n;
  } catch (e) {
    console.error('[notif] show failed:', e);
    return null;
  }
};

/* ==================== TAB TITLE + FAVICON ==================== */
let unreadTotal = 0;

export const setBaseTitle = (t) => {
  const base = t || BASE_TITLE;
  document.title = unreadTotal > 0 ? `(${unreadTotal}) ${base}` : base;
};

export const setUnreadTotal = (n) => {
  unreadTotal = Math.max(0, n | 0);
  document.title =
    unreadTotal > 0 ? `(${unreadTotal}) ${BASE_TITLE}` : BASE_TITLE;
  updateFavicon(unreadTotal > 0);
};

const updateFavicon = (badged) => {
  try {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(14, 18, 36, 24, 6);
    else ctx.rect(14, 18, 36, 24);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(20, 40);
    ctx.lineTo(20, 50);
    ctx.lineTo(30, 42);
    ctx.closePath();
    ctx.fill();

    if (badged) {
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(size - 14, 14, 10, 0, Math.PI * 2);
      ctx.fill();
    }

    const existing = document.getElementById(FAVICON_ID);
    if (existing) existing.remove();

    if (badged) {
      const link = document.createElement('link');
      link.id = FAVICON_ID;
      link.rel = 'icon';
      link.href = canvas.toDataURL('image/png');
      document.head.appendChild(link);
    }
  } catch {}
};

export const isSupported = () => typeof Notification !== 'undefined';