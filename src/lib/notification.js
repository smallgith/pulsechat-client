/* ============================================================
   Notification Manager — sound + browser + tab title + favicon
   ============================================================ */

const SOUND_URL = '/notification.mp3';
const ORIGINAL_TITLE = document.title || 'PulseChat';
const FAVICON_ID = 'pulsechat-favicon';

/* ================== AUDIO ================== */
let audioCtx = null;
let audioBuffer = null;
let audioUnlocked = false;
let soundCacheBlobUrl = null;

/* ---------- unlock on user gesture ---------- */
export const unlockAudio = async () => {
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      await audioCtx.resume();
    }

    // silent beep to keep context alive
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    gain.gain.value = 0.0001;
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(0);
    osc.stop(0.01);

    audioUnlocked = true;

    // pre-load sound file
    loadSound().catch(() => {});
    return true;
  } catch (e) {
    console.warn('[audio] unlock failed', e);
    return false;
  }
};

/* ---------- load mp3 file ---------- */
const loadSound = async () => {
  if (audioBuffer) return audioBuffer;
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  try {
    const res = await fetch(SOUND_URL, { cache: 'force-cache' });
    if (!res.ok) throw new Error('sound 404');
    const arr = await res.arrayBuffer();
    audioBuffer = await audioCtx.decodeAudioData(arr);
    console.log('[audio] sound loaded ✓');
    return audioBuffer;
  } catch (e) {
    console.warn('[audio] load failed, using synth fallback', e);
    return null;
  }
};

/* ---------- play notification sound ---------- */
export const playSound = async () => {
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      await audioCtx.resume();
    }

    // try mp3 first
    const buf = await loadSound();
    if (buf) {
      const src = audioCtx.createBufferSource();
      src.buffer = buf;
      const gain = audioCtx.createGain();
      gain.gain.value = 0.6;
      src.connect(gain);
      gain.connect(audioCtx.destination);
      src.start(0);
      return;
    }

    // fallback: synthesized WhatsApp-like ding
    const now = audioCtx.currentTime;

    // note 1
    const osc1 = audioCtx.createOscillator();
    const gain1 = audioCtx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, now);
    osc1.frequency.exponentialRampToValueAtTime(1320, now + 0.08);
    gain1.gain.setValueAtTime(0.0001, now);
    gain1.gain.exponentialRampToValueAtTime(0.35, now + 0.015);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
    osc1.connect(gain1);
    gain1.connect(audioCtx.destination);
    osc1.start(now);
    osc1.stop(now + 0.26);

    // note 2
    const osc2 = audioCtx.createOscillator();
    const gain2 = audioCtx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1175, now + 0.12);
    gain2.gain.setValueAtTime(0.0001, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.3, now + 0.14);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
    osc2.connect(gain2);
    gain2.connect(audioCtx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.42);
  } catch (e) {
    console.warn('[audio] play failed', e);
  }
};

/* ================== BROWSER NOTIFICATIONS ================== */
export const getPermission = () =>
  typeof Notification !== 'undefined' ? Notification.permission : 'unsupported';

export const requestPermission = async () => {
  if (typeof Notification === 'undefined') return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';

  try {
    const p = await Notification.requestPermission();
    return p;
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
}) => {
  if (typeof Notification === 'undefined') return null;
  if (Notification.permission !== 'granted') return null;

  // skip if tab focused AND not forced
  if (!force && document.visibilityState === 'visible' && document.hasFocus()) {
    return null;
  }

  try {
    // prefer service worker (works on mobile + background)
    if (navigator.serviceWorker?.controller) {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(title || 'PulseChat', {
        body: body || '',
        icon: icon || '/favicon.ico',
        badge: '/favicon.ico',
        tag: tag || 'pulsechat',
        renotify: true,
        silent: true, // we play our own sound
        vibrate: [200, 100, 200],
        data: { url: '/' },
      });
      return null;
    }

    // fallback: direct Notification API
    const n = new Notification(title || 'PulseChat', {
      body: body || '',
      icon: icon || '/favicon.ico',
      badge: '/favicon.ico',
      tag: tag || 'pulsechat',
      renotify: true,
      silent: true,
    });

    n.onclick = () => {
      window.focus();
      n.close();
      onClick?.();
    };

    setTimeout(() => n.close(), 7000);
    return n;
  } catch (e) {
    console.warn('[notif] show failed', e);
    return null;
  }
};

/* ================== TAB TITLE + FAVICON ================== */
let baseTitle = ORIGINAL_TITLE;
let unreadTotal = 0;

export const setBaseTitle = (t) => {
  baseTitle = t || 'PulseChat';
  document.title = unreadTotal > 0 ? `(${unreadTotal}) ${baseTitle}` : baseTitle;
};

export const setUnreadTotal = (n) => {
  unreadTotal = Math.max(0, n | 0);
  document.title = unreadTotal > 0 ? `(${unreadTotal}) ${baseTitle}` : baseTitle;
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