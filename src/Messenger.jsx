import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Login from './components/Login';
import Sidebar from './components/Sidebar';
import ChatWindow from './components/ChatWindow';
import Toast from './components/Toast';
import NotificationPrompt from './components/NotificationPrompt';
import InstallAppPrompt from './components/InstallAppPrompt';
import CallModal from './components/CallModal';
import ConfirmDialog from './components/ConfirmDialog';
import FeatureDialog from './components/FeatureDialog';
import { authHeaders, createSocket, roomId, SOCKET_URL } from './lib/socket';
import { CallSession } from './lib/webrtc';
import {
  playSound,
  setUnreadTotal,
  showBrowserNotification,
  unlockAudio,
} from './lib/notification';
import { shortPreview } from './lib/format';
import { enablePush, isPushEnabled, syncNotificationAccount, clearNotificationAccount, notificationReplyContext, readNotificationDraft } from './lib/push';
import WorkDialog, { workDialogTypes } from './components/WorkDialog';
import AppLock from './components/AppLock';
import DeviceLinkApproval from './components/DeviceLinkApproval';
import { useAppLock } from './hooks/useAppLock';
import { useGroupCalls } from './hooks/useGroupCalls';
import GroupCallPanel from './components/GroupCallPanel';
import { resolveMediaUrl } from './lib/media-url';
import { SHORTCUTS, loadShortcuts, actionForKey } from './lib/shortcuts';

const USER_KEY = 'pulsechat.user';
const defaultPrefs = {
  muted: [],
  favorites: [],
  pinned: [],
  archived: [],
  blocked: [],
  starred: [],
  hidden: [],
};
const merge = (a = [], b = []) =>
  [...new Map([...a, ...b].map((m) => [m.id, m])).values()].sort(
    (a, b) => new Date(a.time) - new Date(b.time)
  );
const newId = () => crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export default function Messenger() {
  const [me, setMe] = useState(() => {
    try {
      const u = JSON.parse(localStorage.getItem(USER_KEY));
      return u?.token ? u : null;
    } catch {
      return null;
    }
  });
  const lastIdentity = useRef(me?.phone || null);
  const [authError, setAuthError] = useState('');
  const [connected, setConnected] = useState(false);
  const [users, setUsers] = useState([]),
    [groups, setGroups] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [conversations, setConversations] = useState({});
  const [preferences, setPreferences] = useState(defaultPrefs);
  const [statuses, setStatuses] = useState([]),
    [calls, setCalls] = useState([]);
  const [scheduled, setScheduled] = useState([]),
    [reports, setReports] = useState([]);
  const [scheduledDraft, setScheduledDraft] = useState(null);
  const [shortcuts, setShortcuts] = useState(loadShortcuts);
  useEffect(() => localStorage.setItem('pulsechat.shortcuts', JSON.stringify(shortcuts)), [shortcuts]);
  const [theme, setTheme] = useState(() => localStorage.getItem('pulsechat.theme') || 'daylight');
  const [customTheme, setCustomTheme] = useState(() => {
    try { return { accent: '#7050cc', chat: '#f8f6fc', ...JSON.parse(localStorage.getItem('pulsechat.customTheme') || '{}') }; }
    catch { return { accent: '#7050cc', chat: '#f8f6fc' }; }
  });
  const [, refreshClock] = useState(0);
  const [typing, setTyping] = useState({});
  const [toast, setToast] = useState(null),
    [dialog, setDialog] = useState(null),
    [confirm, setConfirm] = useState(null);
  const [call, setCall] = useState(null),
    [localStream, setLocalStream] = useState(null),
    [remoteStream, setRemoteStream] = useState(null);
  const lock = useAppLock(me?.phone, !!call);
  const socketRef = useRef(null),
    sessionRef = useRef(null),
    callRef = useRef(null);
  const latest = useRef({}),
    iceQueue = useRef(new Map()),
    knownIds = useRef(new Set()),
    typingTimers = useRef({});
  const selected = [...users, ...groups].find((u) => u.phone === selectedId) || null;
  latest.current = {
    me,
    selectedId,
    preferences,
    users,
    groups,
    conversations,
    locked: lock.locked,
  };
  callRef.current = call;
  const notice = useCallback((preview, from = 'PulseChat') => {
    setToast({ from, preview, time: '' });
  }, []);
  useEffect(() => {
    const value = ['daylight', 'midnight', 'sage', 'ocean', 'blush', 'aurora', 'forest', 'sunset', 'slate', 'custom'].includes(theme) ? theme : 'daylight';
    document.documentElement.dataset.theme = value;
    localStorage.setItem('pulsechat.theme', value);
    localStorage.setItem('pulsechat.customTheme', JSON.stringify(customTheme));
    const hexToRgb = (hex) => hex.match(/[a-f\d]{2}/gi).map((v) => parseInt(v, 16));
    if (value === 'custom') {
      const [r, g, b] = hexToRgb(customTheme.accent);
      document.documentElement.style.setProperty('--brand-400', `${Math.min(255, r + 28)} ${Math.min(255, g + 28)} ${Math.min(255, b + 28)}`);
      document.documentElement.style.setProperty('--brand-500', `${r} ${g} ${b}`);
      document.documentElement.style.setProperty('--brand-600', `${Math.round(r * .86)} ${Math.round(g * .86)} ${Math.round(b * .86)}`);
      document.documentElement.style.setProperty('--chat', customTheme.chat);
      document.documentElement.style.setProperty('--chat-custom', customTheme.chat);
    } else {
      ['--brand-400', '--brand-500', '--brand-600', '--chat'].forEach((key) => document.documentElement.style.removeProperty(key));
    }
  }, [theme, customTheme]);
  useEffect(() => {
    const remaining = preferences.focusUntil - Date.now();
    if (remaining > 0) {
      const timer = setTimeout(() => refreshClock((v) => v + 1), remaining + 10);
      return () => clearTimeout(timer);
    }
  }, [preferences.focusUntil]);
  const openFeature = (type, extra = {}) => {
    if (type === 'lock_now') {
      if (callRef.current) notice('End the current call before locking.');
      else lock.lock();
      return;
    }
    setDialog({ type, ...extra });
  };
  useEffect(() => {
    const shortcut = (e) => {
      if (!me || lock.locked) return;
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      const mapped = actionForKey(e, shortcuts);
      if (mapped && !((e.ctrlKey || e.metaKey) && e.target?.matches?.('[data-message-composer]') && ['b','i'].includes(key))) {
        if (!e.ctrlKey && !e.metaKey && !e.altKey && e.target?.matches?.('input, textarea, select, [contenteditable]')) return;
        e.preventDefault();
        if (mapped === 'focus') document.querySelector('[data-message-composer]')?.focus();
        if (mapped === 'command') setDialog({ type: 'command' });
        if (mapped === 'search') document.querySelector('[aria-label="Search chats"]')?.focus();
        if (mapped === 'searchChat') window.dispatchEvent(new Event('pulsechat:search-chat'));
        if (mapped === 'newGroup') setDialog({ type: 'group_create' });
        if (mapped === 'theme') setDialog({ type: 'theme' });
        if (mapped === 'profile') setDialog({ type: 'profile' });
        if (mapped === 'gallery') window.dispatchEvent(new Event('pulsechat:open-gallery'));
        if (mapped === 'guide') setDialog({ type: 'shortcuts' });
        if (mapped === 'lock' && !callRef.current) lock.lock();
        return;
      }
      if (mod && key === 'j') { e.preventDefault(); document.querySelector('[data-message-composer]')?.focus(); }
      else if (!mod && key === '/' && !/input|textarea|select/i.test(e.target?.tagName || '') && !e.target?.isContentEditable) { e.preventDefault(); document.querySelector('[aria-label="Search chats"]')?.focus(); }
      else if (mod && /^[1-9]$/.test(key) && !e.shiftKey && !e.altKey) {
        const all = [...latest.current.users, ...latest.current.groups].filter(u => u.phone !== latest.current.me?.phone);
        if (all[Number(key)-1]) { e.preventDefault(); setSelectedId(all[Number(key)-1].phone); }
      }
      else if (mod && key === 'n' && !e.shiftKey && !e.altKey) { e.preventDefault(); setSelectedId(null); document.querySelector('[data-message-composer]')?.focus(); }
      else if (mod && e.shiftKey && key === 'm') { e.preventDefault(); if (selectedId) { request('preferences', { key: 'muted', value: selectedId, enabled: !preferences.muted.includes(selectedId) }); } }
      else if (mod && e.shiftKey && key === 'p') { e.preventDefault(); if (selectedId) { request('preferences', { key: 'pinned', value: selectedId, enabled: !preferences.pinned.includes(selectedId) }); } }
      else if (mod && e.shiftKey && key === 'a') { e.preventDefault(); if (selectedId) { request('preferences', { key: 'archived', value: selectedId, enabled: !preferences.archived.includes(selectedId) }); } }
      else if (mod && e.shiftKey && key === 'f') { e.preventDefault(); if (selectedId) { request('preferences', { key: 'favorites', value: selectedId, enabled: !preferences.favorites.includes(selectedId) }); } }
      else if (mod && e.shiftKey && key === 'b') { e.preventDefault(); if (selectedId) { chatAction('block', latest.current.users.find((u) => u.phone === selectedId)).catch(e => notice(e.message)); } }
      else if (mod && e.shiftKey && key === 'd') { e.preventDefault(); if (selectedId) { chatAction('delete', latest.current.users.find((u) => u.phone === selectedId)).catch(e => notice(e.message)); } }




      else if (e.key === 'Escape') setDialog(null);
      else if (e.altKey && ['arrowup', 'arrowdown'].includes(key) && !/input|textarea|select/i.test(e.target?.tagName || '')) {
        e.preventDefault();
        const all = [...latest.current.users, ...latest.current.groups].filter((u) => u.phone !== latest.current.me?.phone);
        if (all.length) {
          const index = all.findIndex((u) => u.phone === latest.current.selectedId);
          setSelectedId(all[(index + (key === 'arrowdown' ? 1 : -1) + all.length) % all.length].phone);
        }
      }
    };
    document.addEventListener('keydown', shortcut);
    return () => document.removeEventListener('keydown', shortcut);
  }, [me?.phone, lock.locked, lock.lock, shortcuts]);
  const request = useCallback((event, payload, wait = true) => {
    const socket = socketRef.current;
    if (!socket?.connected)
      return Promise.reject(new Error('Connection lost. Please wait for reconnection.'));
    if (!wait) {
      socket.emit(event, payload);
      return Promise.resolve();
    }
    return new Promise((resolve, reject) =>
      socket.timeout(15000).emit(event, payload, (err, res) => {
        if (err) reject(new Error('Server did not respond. Please try again.'));
        else if (!res?.ok) reject(new Error(res?.error || 'Could not complete the action'));
        else resolve(res);
      })
    );
  }, []);
  const groupCalling = useGroupCalls({ connected, socketRef, request, me, notice, directCallRef: callRef });
  const endCall = useCallback((remote = false) => {
    const c = callRef.current;
    if (c && !remote) socketRef.current?.emit('call_end', { callId: c.callId });
    callRef.current = null;
    const session = sessionRef.current;
    sessionRef.current = null;
    session?.destroy();
    iceQueue.current.clear();
    setCall(null);
    setLocalStream(null);
    setRemoteStream(null);
  }, []);
  const select = useCallback(
    async (u) => {
      if (!u) return;
      setSelectedId(u.phone);
      setDialog(null);
      try {
        const res = await request('get_history', { with: u.phone });
        setConversations((p) => ({ ...p, [res.roomId]: res.messages }));
      } catch (e) {
        notice(e.message);
      }
    },
    [request, notice]
  );

  useEffect(() => {
    const handler = () => {
      unlockAudio();
    };
    document.addEventListener('pointerdown', handler, { once: true });
    return () => {
      document.removeEventListener('pointerdown', handler);
    };
  }, []);
  useEffect(() => {
    if (!me?.token) return;
    const socket = createSocket();
    socketRef.current = socket;
    const updateMessage = (msg) =>
      setConversations((p) => ({ ...p, [msg.roomId]: merge(p[msg.roomId], [msg]) }));
    const reportVisibility = () => socket.connected && socket.emit('client_visibility', { visible: document.visibilityState === 'visible' && document.hasFocus() });
    const visibilityPulse = setInterval(reportVisibility, 25000);
    document.addEventListener('visibilitychange', reportVisibility);
    window.addEventListener('focus', reportVisibility);
    window.addEventListener('blur', reportVisibility);
    socket.on('connect', () => {
      reportVisibility();
      socket.timeout(15000).emit('register', { token: me.token, name: me.name }, (err, res) => {
        if (err) {
          setConnected(false);
          notice('Could not sync chats. Reconnecting…');
          socket.disconnect().connect();
          return;
        }
        if (!res?.ok) {
          if (res?.code === 'SESSION_EXPIRED') {
            clearNotificationAccount().catch(() => {});
            setAuthError(res.error);
            localStorage.removeItem(USER_KEY);
            setMe(null);
          } else {
            setConnected(false);
            notice('Could not sync chats. Your sign-in is saved. Please reconnect.');
            socket.disconnect();
            setTimeout(() => { if (socketRef.current === socket) socket.connect(); }, 3000);
          }
          return;
        }
        knownIds.current = new Set(
          Object.values(res.conversations || {})
            .flat()
            .map((m) => m.id)
        );
        setUsers(res.users || []);
        setGroups(res.groups || []);
        const incoming = res.conversations || {};
        const previousCount = Object.values(latest.current.conversations || {}).reduce((sum, items) => sum + items.length, 0);
        const newCount = Object.values(incoming).reduce((sum, items) => sum + items.length, 0);
        if (previousCount && !newCount) notice('Server returned no chat history. This session’s messages remain visible; check Render persistent storage before reloading.');
        else setConversations(incoming);
        setPreferences({ ...defaultPrefs, ...res.preferences });
        setStatuses(res.statuses || []);
        setCalls(res.calls || []);
        setConnected(true);
        reportVisibility();
        setScheduled(res.scheduled || []);
        setReports(res.reports || []);
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted')
          enablePush().catch(() => {});
        setMe((p) => {
          const next = { ...p, ...res.user, expiresAt: res.expiresAt };
          localStorage.setItem(USER_KEY, JSON.stringify(next));
          return next;
        });
        const query = new URLSearchParams(window.location.search);
        const queryPhone = query.get('chat');
        if (queryPhone && [...res.users, ...res.groups].some((u) => u.phone === queryPhone)) {
          setSelectedId(queryPhone);
          // The reply flag remains in the URL until the app is unlocked and ready.
        }
        if (query.get('invite')) setDialog({ type: 'invite' });
        else if (query.get('compose') === '1') setDialog({ type: 'command' });
      });
    });
    socket.on('disconnect', () => {
      setConnected(false);
      endCall(true);
    });
    socket.on('connect_error', () => setConnected(false));
    socket.on('users', (list) => setUsers(list));
    socket.on('groups', (list) => {
      setGroups(list);
      setConversations((p) =>
        Object.fromEntries(
          Object.entries(p).filter(
            ([rid]) => !rid.startsWith('group:') || list.some((g) => g.phone === rid)
          )
        )
      );
      const id = latest.current.selectedId;
      if (id?.startsWith('group:') && !list.some((g) => g.phone === id)) {
        setSelectedId(null);
        setDialog(null);
        notice('You are no longer a member of this group.');
      }
    });
    socket.on('preferences', (p) => setPreferences({ ...defaultPrefs, ...p }));
    socket.on('profile', (user) =>
      setMe((p) => {
        const next = { ...p, ...user };
        localStorage.setItem(USER_KEY, JSON.stringify(next));
        return next;
      })
    );
    socket.on('statuses', setStatuses);
    socket.on('calls', setCalls);
    socket.on('scheduled', setScheduled);
    socket.on('reports', setReports);
    socket.on('message_updated', updateMessage);
    socket.on('message', (msg) => {
      updateMessage(msg);
      if (knownIds.current.has(msg.id)) return;
      knownIds.current.add(msg.id);
      const state = latest.current;
      if (msg.from === me.phone) return;
      const targetId = msg.to.startsWith('group:') ? msg.to : msg.from;
      const active =
        state.selectedId === targetId &&
        document.visibilityState === 'visible' &&
        document.hasFocus();
      if (
        state.locked ||
        state.preferences.focusUntil > Date.now() ||
        active ||
        state.preferences.muted.includes(targetId) ||
        (!msg.to.startsWith('group:') && state.preferences.blocked.includes(msg.from))
      )
        return;
      const target = [...state.users, ...state.groups].find((u) => u.phone === targetId);
      const senderName = target?.name || msg.fromName;
      const canReply = !target?.settings?.adminsOnly || target.admins?.includes(me.phone);
      const preview = `${msg.to.startsWith('group:') ? `${msg.fromName}: ` : ''}${shortPreview(msg)}`;
      const foreground = document.visibilityState === 'visible' && document.hasFocus();
      if (foreground && !active) playSound();
      if ((!foreground || !active) && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        const notify = async () => {
          const state = latest.current;
          if (state.me?.token !== me.token || state.locked || state.preferences.muted.includes(targetId) || state.preferences.blocked.includes(msg.from) ||
              state.preferences.focusUntil > Date.now() ||
              (state.selectedId === targetId && document.visibilityState === 'visible' && document.hasFocus())) return;
          const registration = await navigator.serviceWorker?.getRegistration();
          const existing = await registration?.getNotifications({ tag: `chat-${msg.roomId}` });
          if (existing?.some((notification) => notification.data?.messageId === msg.id)) return;
          const reply = await notificationReplyContext(targetId, msg.id).catch(() => null);
          await showBrowserNotification({
            title: senderName, body: preview, icon: resolveMediaUrl(target?.avatarUrl) || '/icon-192.png',
            image: msg.file?.mime?.startsWith('image/') ? resolveMediaUrl(msg.file.url) : undefined,
            tag: `chat-${msg.roomId}`, force: true, chatUrl: `/?chat=${encodeURIComponent(targetId)}`,
            onClick: () => setSelectedId(targetId), messageId: msg.id, user: me.phone, chat: targetId, reply, canReply,
          });
        };
        // Push normally handles background tabs. Fall back if delivery/visibility raced.
        if (isPushEnabled()) setTimeout(() => notify().catch(() => {}), 1800);
        else notify().catch(() => {});
      }
      // Incoming messages use OS/browser notifications only; avoid an extra in-app popup.
    });
    socket.on('chat_cleared', ({ roomId: rid }) => setConversations((p) => ({ ...p, [rid]: [] })));
    socket.on('messages_expired', ({ roomId: rid, ids }) =>
      setConversations((p) => ({ ...p, [rid]: (p[rid] || []).filter((m) => !ids.includes(m.id)) }))
    );
    socket.on('typing', (data) => {
      const key = `${data.roomId}/${data.from}`;
      clearTimeout(typingTimers.current[key]);
      setTyping((p) => ({ ...p, [key]: data.isTyping ? data : null }));
      if (data.isTyping)
        typingTimers.current[key] = setTimeout(
          () => setTyping((p) => ({ ...p, [key]: null })),
          4000
        );
    });
    socket.on('incoming_call', (data) => {
      if (callRef.current?.callId === data.callId) return;
      if (callRef.current || groupCalling.activeRef.current) {
        socket.emit('call_reject', { callId: data.callId });
        return;
      }
      const c = {
        type: data.type,
        peer: data.from,
        peerName: data.fromName,
        state: 'incoming',
        callId: data.callId,
        isIncoming: true,
        _offer: data.offer,
      };
      callRef.current = c;
      setCall(c);
      if (document.visibilityState !== 'visible')
        showBrowserNotification({
          title: latest.current.locked ? 'PulseChat' : data.fromName,
          body: `Incoming ${data.type === 'video' ? 'video' : 'voice'} call`,
          tag: `call-${data.callId}`,
          force: true,
          chatUrl: `/?chat=${data.from}`,
        });
    });
    socket.on('call_answer', async ({ answer, callId }) => {
      if (sessionRef.current?.callId !== callId) return;
      try {
        await sessionRef.current.acceptAnswer(answer);
        setCall((c) => (c && c.state !== 'connected' ? { ...c, state: 'connecting' } : c));
      } catch {
        notice('Could not connect the call');
        endCall();
      }
    });
    socket.on('call_ice', ({ candidate, callId }) => {
      if (sessionRef.current?.callId === callId) sessionRef.current.addIce(candidate);
      else if (callRef.current?.callId === callId)
        iceQueue.current.set(callId, [...(iceQueue.current.get(callId) || []), candidate]);
    });
    for (const event of ['call_ended', 'call_rejected'])
      socket.on(event, ({ callId, reason }) => {
        if (callRef.current?.callId !== callId) return;
        endCall(true);
        if (reason === 'missed') notice('No answer. Call ended.');
        if (reason === 'declined') notice('Call declined');
        if (reason === 'interrupted') notice('Call ended because the connection was lost.');
      });
    return () => {
      clearInterval(visibilityPulse);
      document.removeEventListener('visibilitychange', reportVisibility);
      window.removeEventListener('focus', reportVisibility);
      window.removeEventListener('blur', reportVisibility);
      socket.disconnect();
      socketRef.current = null;
      endCall(true);
      Object.values(typingTimers.current).forEach(clearTimeout);
    };
  }, [me?.token, notice, endCall]);

  const allChats = useMemo(
    () => [
      ...users.filter((u) => u.phone !== me?.phone),
      ...(me
        ? [
            {
              ...users.find((u) => u.phone === me.phone),
              phone: me.phone,
              name: 'Message yourself',
              isSelf: true,
              about: 'Your private notes and reminders',
            },
          ]
        : []),
      ...groups,
    ],
    [users, groups, me?.phone]
  );
  const unread = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(conversations).map(([rid, list]) => [
          rid,
          list.filter(
            (m) =>
              m.from !== me?.phone &&
              !m.deleted &&
              !m.deletedFor?.includes(me?.phone) &&
              !m.readBy?.includes(me?.phone)
          ).length,
        ])
      ),
    [conversations, me?.phone]
  );
  const activeMessages = useMemo(
    () =>
      (conversations[roomId(me?.phone, selectedId)] || []).filter(
        (m) => !m.deletedFor?.includes(me?.phone)
      ),
    [conversations, selectedId, me?.phone]
  );
  const lastMessages = useMemo(
    () =>
      Object.fromEntries(
        allChats.map((u) => [
          u.phone,
          (conversations[roomId(me?.phone, u.phone)] || [])
            .filter((m) => !m.deletedFor?.includes(me?.phone))
            .at(-1),
        ])
      ),
    [allChats, conversations, me?.phone]
  );
  useEffect(() => {
    setUnreadTotal(Object.values(unread).reduce((a, n) => a + n, 0));
  }, [unread]);
  useEffect(() => {
    const read = () => {
      if (
        lock.locked ||
        !connected ||
        !selectedId ||
        document.visibilityState !== 'visible' ||
        !document.hasFocus()
      )
        return;
      const ids = activeMessages
        .filter((m) => m.from !== me.phone && !m.readBy?.includes(me.phone))
        .map((m) => m.id);
      if (ids.length)
        socketRef.current?.emit('seen', { roomId: roomId(me.phone, selectedId), ids });
    };
    read();
    window.addEventListener('focus', read);
    document.addEventListener('visibilitychange', read);
    return () => {
      window.removeEventListener('focus', read);
      document.removeEventListener('visibilitychange', read);
    };
  }, [activeMessages, selectedId, connected, me?.phone, lock.locked]);
  useEffect(() => {
    const handler = async (e) => {
      if (e.data?.type === 'OPEN_QUICK_REPLY') {
        const state = latest.current;
        if (e.data.user && state.me?.phone !== e.data.user) return;
        if (!/^(\d{10}|google:[A-Za-z0-9_-]{5,128}|group:[a-f0-9-]{36})$/.test(e.data.chat || '')) return;
        if (state.locked) {
          setSelectedId(e.data.chat);
          const url = new URL(window.location.href);
          url.searchParams.set('chat', e.data.chat); url.searchParams.set('reply', '1');
          if (e.data.messageId) url.searchParams.set('replyTo', e.data.messageId);
          if (e.data.draftId) url.searchParams.set('notificationDraft', e.data.draftId);
          window.history.replaceState(null, '', url);
          return;
        }
        const draft = e.data.draftId ? await readNotificationDraft(e.data.draftId).catch(() => null) : null;
        const target = [...state.users, ...state.groups].find((user) => user.phone === e.data.chat);
        setToast({ from: target?.name || 'Quick reply', preview: 'Reply to this conversation', targetId: e.data.chat,
          _raw: { id: e.data.messageId }, clientId: draft?.clientId, canReply: true, autoFocus: true, draft: draft?.text || '', error: draft?.error || '' });
        return;
      }
      if (e.data?.type === 'OPEN_CHAT' && /^(\d{10}|google:[A-Za-z0-9_-]{5,128}|group:[a-f0-9-]{36})$/.test(e.data.chat || '')) {
        setSelectedId(e.data.chat);
        if (e.data.reply) setTimeout(() => document.querySelector('[data-message-composer]')?.focus(), 200);
      }
    };
    navigator.serviceWorker?.addEventListener('message', handler);
    return () => navigator.serviceWorker?.removeEventListener('message', handler);
  }, []);

  useEffect(() => {
    if (!me?.token) return;
    syncNotificationAccount().catch(() => {});
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') enablePush().catch(() => {});
  }, [me?.phone, me?.token, lock.enabled]);

  useEffect(() => {
    if (!selectedId || lock.locked) return;
    const url = new URL(window.location.href);
    if (url.searchParams.get('reply') !== '1' || url.searchParams.get('chat') !== selectedId) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const target = [...users, ...groups].find((user) => user.phone === selectedId);
      if (!target) return;
      const draftId = url.searchParams.get('notificationDraft');
      const draft = draftId ? await readNotificationDraft(draftId).catch(() => null) : null;
      if (cancelled) return;
      setToast({ from: target.name, preview: 'Reply to this conversation', targetId: selectedId,
        canReply: true, autoFocus: true, clientId: draft?.clientId, draft: draft?.text || '', error: draft?.error || '',
        _raw: { id: url.searchParams.get('replyTo') || draft?.messageId },
      });
      url.searchParams.delete('reply');
      url.searchParams.delete('replyTo'); url.searchParams.delete('notificationDraft');
      window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
    }, 400);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [selectedId, lock.locked, users, groups]);

  const sendTo = async (targetId, payload) => {
    const { files, ...rest } = payload;
    if (files?.length > 1) {
      const batch = payload.clientId || newId();
      for (let i = 0; i < files.length; i++)
        await request('send_message', {
          to: targetId,
          ...rest,
          text: i ? '' : rest.text,
          file: files[i],
          clientId: files[i].transferKey ? `transfer:${files[i].transferKey}` : `${batch}-${i}`,
        });
    } else
      await request('send_message', {
        to: targetId,
        ...rest,
        clientId: payload.clientId || newId(),
      });
  };
  const send = async (payload) => {
    await sendTo(latest.current.selectedId, payload);
  };
  const setPref = (key, value) =>
    request('preferences', { key, value, enabled: !preferences[key].includes(value) });
  const deleteMessage = (m, forEveryone) =>
    request('delete_message', { roomId: m.roomId, messageId: m.id, forEveryone }).catch((e) =>
      notice(e.message)
    );
  const chatAction = async (action, target = selected) => {
    if (!target) return;
    const id = target.phone;
    if (['board', 'lists', 'report', 'task', 'decision', 'schedule'].includes(action)) {
      openFeature(action, { user: target });
      return;
    }
    if (action === 'focus') {
      await request('focus_mode', { enabled: !(preferences.focusUntil > Date.now()) });
      return;
    }
    if (['mute', 'favorite', 'pin', 'archive', 'block'].includes(action)) {
      const key = {
        mute: 'muted',
        favorite: 'favorites',
        pin: 'pinned',
        archive: 'archived',
        block: 'blocked',
      }[action];
      if (action === 'block' && !preferences.blocked.includes(id))
        setConfirm({
          title: `Block ${target.name}?`,
          message: 'You will no longer exchange direct messages or calls with this contact.',
          run: () => setPref(key, id),
        });
      else await setPref(key, id);
    } else if (['contact', 'media', 'starred'].includes(action))
      setDialog({ type: action, user: target });
    else if (action === 'disappearing') setDialog({ type: 'timer', user: target });
    else if (['clear', 'delete'].includes(action))
      setConfirm({
        title: action === 'clear' ? 'Clear chat?' : 'Delete chat?',
        message: 'Messages will be removed for you. Other members keep their copies.',
        run: async () => {
          await request('clear_chat', { with: id, hide: action === 'delete' });
          if (action === 'delete' && selectedId === id) setSelectedId(null);
        },
      });
    else if (action === 'export') {
      const content = activeMessages
        .map(
          (m) =>
            `[${new Date(m.time).toLocaleString()}] ${m.fromName}: ${m.deleted ? 'Message deleted' : m.text || ''}${m.file ? ` [${m.file.name}] ${m.file.url}` : ''}${m.voice ? ` [Voice] ${m.voice.url}` : ''}${m.gif ? ` [GIF] ${m.gif.url}` : ''}`
        )
        .join('\n');
      const url = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `PulseChat-${target.name.replace(/[^a-z0-9]/gi, '_')}.txt`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } else if (action === 'share') {
      try {
        await navigator.clipboard.writeText(`${location.origin}/?chat=${encodeURIComponent(id)}`);
        notice('Chat link copied');
      } catch {
        notice('Clipboard unavailable. Open contact info to copy the phone number.');
      }
    }
  };

  const makeSession = (c, pendingIce) =>
    new CallSession({
      callId: c.callId,
      peerId: c.peer,
      type: c.type,
      onIce: (candidate) => {
        if (pendingIce.ready) socketRef.current?.emit('call_ice', { candidate, callId: c.callId });
        else pendingIce.candidates.push(candidate);
      },
      onRemoteStream: setRemoteStream,
      onConnected: () =>
        setCall((p) =>
          p?.callId === c.callId
            ? { ...p, state: 'connected', connectedAt: p.connectedAt || Date.now() }
            : p
        ),
      onEnded: () => {
        if (callRef.current?.callId === c.callId) {
          notice('Call connection ended');
          endCall();
        }
      },
    });
  const startCall = async (type, target = selected) => {
    if (!target || target.phone === me.phone) return;
    if (target.isGroup) {
      if (callRef.current || groupCalling.call) { notice('Finish the current call first'); return; }
      try { await groupCalling.start(target, type); } catch (e) { notice(e.message); }
      return;
    }
    if (groupCalling.call) { notice('Finish the group call first'); return; }
    if (callRef.current) {
      notice('End your current call first');
      return;
    }
    if (!connected || preferences.blocked.includes(target.phone)) {
      notice('This contact is unavailable for a call');
      return;
    }
    const c = {
      type,
      peer: target.phone,
      peerName: target.name,
      state: 'preparing',
      callId: newId(),
      isIncoming: false,
    };
    callRef.current = c;
    setCall(c);
    const pendingIce = { ready: false, candidates: [] };
    const session = makeSession(c, pendingIce);
    sessionRef.current = session;
    try {
      const local = await session.startLocal();
      if (callRef.current?.callId !== c.callId) {
        session.destroy();
        return;
      }
      setLocalStream(local);
      const offer = await session.createOffer();
      if (callRef.current?.callId !== c.callId) return;
      await request('call_user', { to: c.peer, type, offer, callId: c.callId });
      if (callRef.current?.callId !== c.callId) {
        socketRef.current?.emit('call_end', { callId: c.callId });
        return;
      }
      pendingIce.ready = true;
      pendingIce.candidates.forEach((candidate) =>
        socketRef.current?.emit('call_ice', { candidate, callId: c.callId })
      );
      setCall((p) => (p ? { ...p, state: 'calling' } : p));
    } catch (e) {
      notice(e.message || 'Could not access microphone or camera');
      if (callRef.current?.callId === c.callId) endCall();
      else session.destroy();
    }
  };
  const acceptCall = async () => {
    const c = callRef.current;
    if (!c || c.state !== 'incoming') return;
    callRef.current = { ...c, state: 'connecting' };
    setCall(callRef.current);
    const pendingIce = { ready: true, candidates: [] },
      session = makeSession(c, pendingIce);
    sessionRef.current = session;
    try {
      const local = await session.startLocal();
      if (callRef.current?.callId !== c.callId) {
        session.destroy();
        return;
      }
      setLocalStream(local);
      for (const candidate of iceQueue.current.get(c.callId) || []) await session.addIce(candidate);
      iceQueue.current.delete(c.callId);
      const answer = await session.acceptOffer(c._offer);
      if (callRef.current?.callId !== c.callId) return;
      await request('call_answer', { answer, callId: c.callId });
    } catch (e) {
      notice(e.message || 'Could not answer call');
      socketRef.current?.emit('call_reject', { callId: c.callId });
      endCall(true);
      session.destroy();
    }
  };
  const logout = async () => {
    await clearNotificationAccount();
    endCall();
    groupCalling.leave();
    try {
      await fetch(`${SOCKET_URL}/api/logout`, {
        method: 'POST',
        headers: authHeaders(),
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      /* Local logout still works offline. */
    }
    socketRef.current?.disconnect();
    localStorage.removeItem(USER_KEY);
    setMe(null);
    setSelectedId(null);
    setConversations({});
    setUsers([]);
    setGroups([]);
    setPreferences(defaultPrefs);
    setToast(null);
    setDialog(null);
    setUnreadTotal(0);
  };
  if (!me)
    return (
      <Login
        error={authError}
        onJoin={(u) => {
          if (lastIdentity.current && lastIdentity.current !== u.phone) {
            setConversations({}); setSelectedId(null); setGroups([]); setUsers([]);
            knownIds.current.clear();
          }
          lastIdentity.current = u.phone;
          localStorage.setItem(USER_KEY, JSON.stringify(u));
          setMe(u);
          setAuthError('');
        }}
      />
    );
  if (lock.locked)
    return (
      <AppLock
        lock={lock}
        onLogout={async () => {
          await logout();
          lock.forget();
        }}
      />
    );
  const typingPeople = Object.values(typing).filter(
    (t) => t?.roomId === roomId(me.phone, selectedId)
  );
  return (
    <div className="app-shell h-[100dvh] flex overflow-hidden">
      <div className={`${selected ? 'hidden md:flex' : 'flex'} w-full md:w-auto md:shrink-0`}>
        <Sidebar
          me={me}
          users={allChats}
          selected={selected}
          onSelect={select}
          lastMessages={lastMessages}
          unread={unread}
          connected={connected}
          preferences={preferences}
          onLogout={logout}
          onFeature={openFeature}
          lockEnabled={lock.enabled}
          onChatAction={(action, target) => chatAction(action, target).catch(e => notice(e.message))}
          onBulk={async (action, targets) => {
            try {
              if (action === 'read') await request('mark_read', { targets });
              else
                for (const id of targets || [])
                  await request('preferences', { key: 'archived', value: id, enabled: true });
            } catch (e) {
              notice(e.message);
            }
          }}
        />
      </div>
      <div className={`${selected ? 'flex' : 'hidden md:flex'} app-chat flex-1 min-w-0 w-full`}>
        <ChatWindow
          key={selectedId || 'empty'}
          me={me.phone}
          user={selected}
          messages={activeMessages}
          people={allChats}
          typing={typingPeople.length ? typingPeople.map((p) => p.fromName).join(', ') : ''}
          muted={preferences.muted.includes(selectedId)}
          favorite={preferences.favorites.includes(selectedId)}
          preferences={preferences}
          connected={connected}
          scheduledDraft={scheduledDraft}
          onSend={(payload) => sendTo(selected.phone, payload)}
          onCompose={(type, extra) => openFeature(type, { user: selected, ...extra })}
          onFeature={openFeature}
          onCardAction={(m, action, data) =>
            request('message_action', { roomId: m.roomId, messageId: m.id, action, ...data })
          }
          onOpenContact={(contact) => {
            const digits = contact.phone.replace(/\D/g, '');
            const user = users.find((u) => u.phone === digits || `91${u.phone}` === digits);
            if (user) select(user);
            else
              notice(
                'This contact has not joined PulseChat yet. Save their contact card and invite them to sign in.'
              );
          }}
          onTask={(message) => openFeature('task', { user: selected, message })}
          onDecision={(message) => openFeature('decision', { user: selected, message })}
          onTyping={(isTyping) => {
            if (socketRef.current?.connected)
              socketRef.current.emit('typing', { to: selectedId, isTyping });
          }}
          onBack={() => setSelectedId(null)}
          onVoiceCall={() => startCall('audio')}
          onVideoCall={() => startCall('video')}
          onDeleteMessage={deleteMessage}
          onReactMessage={(m, emoji) =>
            request('react_message', { roomId: m.roomId, messageId: m.id, emoji }).catch((e) =>
              notice(e.message)
            )
          }
          onEditMessage={(message) => setDialog({ type: 'edit', message })}
          onForwardMessage={(message) => setDialog({ type: 'forward', message })}
          onForwardMany={(messages) => setDialog({ type: 'forward', messages })}
          onStarMessage={(m) => setPref('starred', m.id).catch(e => notice(e.message))}
          onAction={(key) => {
            chatAction(key).catch((e) => notice(e.message));
          }}
        />
      </div>
      <Toast
        toast={toast}
        onClose={(closed) => setToast((current) => !closed || current === closed ? null : current)}
        onOpen={(opened) => {
          if (opened?.targetId) setSelectedId(opened.targetId);
          setToast((current) => current === opened ? null : current);
        }}
        onReply={(text, source) => sendTo(source.targetId, { text, notificationReply: true, clientId: source.clientId, replyTo: source._raw?.id ? { id: source._raw.id } : null })}
      />
      <NotificationPrompt />
      <InstallAppPrompt />
      {groupCalling.call && (
        <GroupCallPanel call={groupCalling.call} localStream={groupCalling.localStream}
          remotes={groupCalling.remotes} participants={groupCalling.participants} onAccept={groupCalling.answer}
          onLeave={groupCalling.leave} onNotice={notice} users={users} />
      )}
      {call && (
        <CallModal
          key={call.callId}
          call={call}
          localStream={localStream}
          remoteStream={remoteStream}
          isIncoming={call.state === 'incoming'}
          onAccept={acceptCall}
          onReject={() => {
            socketRef.current?.emit('call_reject', { callId: call.callId });
            endCall(true);
          }}
          onEnd={() => endCall()}
        />
      )}
      {dialog?.type === 'security' && <AppLock lock={lock} onClose={() => setDialog(null)} />}
      {dialog?.type === 'device_link' && <DeviceLinkApproval onClose={() => setDialog(null)} />}
      {dialog && workDialogTypes.includes(dialog.type) && (
        <WorkDialog
          key={`${dialog.type}/${dialog.user?.phone || ''}/${dialog.message?.id || ''}`}
          dialog={dialog}
          onClose={() => setDialog(null)}
          me={me}
          chats={allChats}
          users={users}
          messages={Object.values(conversations).flat()}
          scheduled={scheduled}
          onScheduled={(target, text) => setScheduledDraft({ id: newId(), target, text })}
          reports={reports}
          preferences={preferences}
          request={request}
          sendTo={sendTo}
          onSelect={async (u, messageId) => {
            await select(u);
            if (messageId)
              requestAnimationFrame(() =>
                requestAnimationFrame(() =>
                  document
                    .getElementById(`msg-${messageId}`)
                    ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                )
              );
          }}
          onAction={(m, action, data) =>
            request('message_action', { roomId: m.roomId, messageId: m.id, action, ...data })
          }
          theme={theme}
          setTheme={setTheme}
          customTheme={customTheme}
          setCustomTheme={setCustomTheme}
          shortcuts={shortcuts}
          setShortcuts={setShortcuts}
          wallpaperAccount={me.phone}
          wallpaperChat={selectedId}
          onFeature={openFeature}
        />
      )}
      {dialog && !workDialogTypes.includes(dialog.type) && dialog.type !== 'security' && dialog.type !== 'device_link' && (
        <FeatureDialog
          key={`${dialog.type}/${dialog.message?.id || dialog.user?.phone || ''}`}
          dialog={dialog}
          onClose={() => setDialog(null)}
          me={me}
          users={users}
          groups={groups}
          statuses={statuses}
          calls={calls}
          messages={
            dialog.user
              ? conversations[roomId(me.phone, dialog.user.phone)] || []
              : Object.values(conversations)
                  .flat()
                  .filter((m) => !m.deletedFor?.includes(me.phone))
          }
          preferences={preferences}
          request={request}
          onSelect={select}
          onCall={startCall}
          onChatAction={(action, target) => chatAction(action, target).catch(e => notice(e.message))}
          onNotice={notice}
          onFeature={openFeature}
          onForward={async (u, list) => {
            for (const m of list)
              await sendTo(u.phone, {
                text: m.text,
                file: m.file,
                voice: m.voice,
                gif: m.gif,
                poll: m.poll
                  ? { ...m.poll, options: m.poll.options.map((o) => o.text) }
                  : undefined,
                task: m.task,
                decision: m.decision,
                contact: m.contact,
                sticker: m.sticker,
                event: m.event?.at > Date.now() ? m.event : undefined,
                forwarded: true,
              });
            await select(u);
          }}
        />
      )}
      <ConfirmDialog
        open={!!confirm}
        title={confirm?.title}
        message={confirm?.message}
        danger
        confirmLabel="Confirm"
        onCancel={() => setConfirm(null)}
        onConfirm={async () => {
          try {
            await confirm.run();
            setConfirm(null);
          } catch (e) {
            notice(e.message);
          }
        }}
      />
    </div>
  );
}
