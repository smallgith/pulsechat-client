/* ============================================================
   Notification Manager — browser + sound + tab title + favicon
   ============================================================ */

const SOUND_URL = "/notification.mp3";
const ORIGINAL_TITLE = document.title || "PulseChat";
const FAVICON_ID = "pulsechat-favicon";

/* ------------------------------ sound ------------------------------ */
let audioCtx = null;
let audioBuffer = null;

const loadSound = async () => {
  if (audioBuffer) return audioBuffer;
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    const res = await fetch(SOUND_URL);
    if (!res.ok) throw new Error("sound missing");
    const arr = await res.arrayBuffer();
    audioBuffer = await audioCtx.decodeAudioData(arr);
    return audioBuffer;
  } catch {
    return null;
  }
};

export const playSound = async () => {
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    // user gesture pachi resume
    if (audioCtx.state === "suspended") await audioCtx.resume();

    const buf = await loadSound();
    if (buf) {
      const src = audioCtx.createBufferSource();
      src.buffer = buf;
      src.connect(audioCtx.destination);
      src.start(0);
      return;
    }

    // fallback: synthesized "ding"
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(1320, now + 0.12);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.28, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.34);
  } catch {
    /* silent */
  }
};

/* -------------------------- browser notifications -------------------------- */
export const getPermission = () =>
  typeof Notification !== "undefined" ? Notification.permission : "unsupported";

export const requestPermission = async () => {
  if (typeof Notification === "undefined") return "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  try {
    const p = await Notification.requestPermission();
    return p;
  } catch {
    return "denied";
  }
};

export const showBrowserNotification = ({
  title,
  body,
  icon,
  tag,
  onClick,
  force = false, // 🔥 NEW — force show even if tab focused
} = {}) => {
  if (typeof Notification === "undefined") return null;
  if (Notification.permission !== "granted") return null;

  // Tab focused hoy ane force=false hoy to skip
  // (kyaki in-app toast pan dekhato chhe — duplicate nahi joie)
  if (!force && document.visibilityState === "visible" && document.hasFocus()) {
    return null;
  }

  try {
    const n = new Notification(title || "New message", {
      body: body || "",
      icon: icon || "/favicon.ico",
      badge: "/favicon.ico",
      tag: tag || "pulsechat-message",
      renotify: true,
      silent: true, // ame j sound play karie chhie
      requireInteraction: false,
    });

    n.onclick = () => {
      window.focus();
      n.close();
      onClick?.();
    };

    setTimeout(() => n.close(), 6000);
    return n;
  } catch {
    return null;
  }
};

/* ------------------------------ tab title ------------------------------ */
let baseTitle = ORIGINAL_TITLE;
let unreadTotal = 0;

export const setBaseTitle = (t) => {
  baseTitle = t || "PulseChat";
  document.title =
    unreadTotal > 0 ? `(${unreadTotal}) ${baseTitle}` : baseTitle;
};

export const setUnreadTotal = (n) => {
  unreadTotal = Math.max(0, n | 0);
  document.title =
    unreadTotal > 0 ? `(${unreadTotal}) ${baseTitle}` : baseTitle;
  updateFavicon(unreadTotal > 0);
};

/* ------------------------------- favicon ------------------------------- */
let baseFaviconHref = null;

const getBaseFavicon = () => {
  if (baseFaviconHref) return baseFaviconHref;
  const link = document.querySelector("link[rel*='icon']");
  baseFaviconHref = link?.href || "";
  return baseFaviconHref;
};

const updateFavicon = (badged) => {
  try {
    const link =
      document.querySelector(`#${FAVICON_ID}`) ||
      document.querySelector("link[rel*='icon']");

    if (!link) return;

    if (!badged) {
      if (link.id === FAVICON_ID) link.remove();
      return;
    }

    const size = 64;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d");

    // base circle
    ctx.fillStyle = "#10b981";
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.fill();

    // white chat glyph (simple)
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.roundRect(14, 18, 36, 24, 6);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(20, 40);
    ctx.lineTo(20, 50);
    ctx.lineTo(30, 42);
    ctx.closePath();
    ctx.fill();

    // red dot
    ctx.fillStyle = "#ef4444";
    ctx.beginPath();
    ctx.arc(size - 14, 14, 10, 0, Math.PI * 2);
    ctx.fill();

    // inject
    const newLink = document.createElement("link");
    newLink.id = FAVICON_ID;
    newLink.rel = "icon";
    newLink.href = canvas.toDataURL("image/png");
    document.head.appendChild(newLink);
    getBaseFavicon();
  } catch {
    /* ignore */
  }
};

/* ------------------------------ permission UI ------------------------------ */
export const isSupported = () => typeof Notification !== "undefined";
