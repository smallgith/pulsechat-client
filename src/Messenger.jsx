import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Login from './components/Login';
import Sidebar from './components/Sidebar';
import ChatWindow from './components/ChatWindow';
import Toast from './components/Toast';
import NotificationPrompt from './components/NotificationPrompt';
import CallModal from './components/CallModal';
import ConfirmDialog from './components/ConfirmDialog';
import FeatureDialog from './components/FeatureDialog';
import { authHeaders, createSocket, roomId, SOCKET_URL } from './lib/socket';
import { CallSession } from './lib/webrtc';
import { playSound, setUnreadTotal, showBrowserNotification, unlockAudio } from './lib/notification';
import { shortPreview } from './lib/format';
import { enablePush } from './lib/push';

const USER_KEY = 'pulsechat.user';
const defaultPrefs = { muted: [], favorites: [], pinned: [], archived: [], blocked: [], starred: [], hidden: [] };
const merge = (a = [], b = []) => [...new Map([...a, ...b].map((m) => [m.id, m])).values()].sort((a, b) => new Date(a.time) - new Date(b.time));
const newId = () => crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export default function Messenger() {
  const [me, setMe] = useState(() => { try { const u = JSON.parse(localStorage.getItem(USER_KEY)); return u?.token ? u : null; } catch { return null; } });
  const [authError, setAuthError] = useState('');
  const [connected, setConnected] = useState(false);
  const [users, setUsers] = useState([]), [groups, setGroups] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [conversations, setConversations] = useState({});
  const [preferences, setPreferences] = useState(defaultPrefs);
  const [statuses, setStatuses] = useState([]), [calls, setCalls] = useState([]);
  const [typing, setTyping] = useState({});
  const [toast, setToast] = useState(null), [dialog, setDialog] = useState(null), [confirm, setConfirm] = useState(null);
  const [call, setCall] = useState(null), [localStream, setLocalStream] = useState(null), [remoteStream, setRemoteStream] = useState(null);
  const socketRef = useRef(null), sessionRef = useRef(null), callRef = useRef(null);
  const latest = useRef({}), toastTimer = useRef(), iceQueue = useRef(new Map()), knownIds = useRef(new Set()), typingTimers = useRef({});
  const selected = [...users, ...groups].find((u) => u.phone === selectedId) || null;
  latest.current = { me, selectedId, preferences, users, groups, conversations };
  callRef.current = call;
  const notice = useCallback((preview, from = 'PulseChat') => { clearTimeout(toastTimer.current); setToast({ from, preview, time: '' }); toastTimer.current = setTimeout(() => setToast(null), 5000); }, []);
  const request = useCallback((event, payload, wait = true) => {
    const socket = socketRef.current;
    if (!socket?.connected) return Promise.reject(new Error('Connection lost. Please wait for reconnection.'));
    if (!wait) { socket.emit(event, payload); return Promise.resolve(); }
    return new Promise((resolve, reject) => socket.timeout(15000).emit(event, payload, (err, res) => {
      if (err) reject(new Error('Server did not respond. Please try again.'));
      else if (!res?.ok) reject(new Error(res?.error || 'Could not complete the action'));
      else resolve(res);
    }));
  }, []);
  const endCall = useCallback((remote = false) => {
    const c = callRef.current;
    if (c && !remote) socketRef.current?.emit('call_end', { callId: c.callId });
    callRef.current = null;
    const session = sessionRef.current; sessionRef.current = null; session?.destroy();
    iceQueue.current.clear(); setCall(null); setLocalStream(null); setRemoteStream(null);
  }, []);
  const select = useCallback(async (u) => {
    if (!u) return;
    setSelectedId(u.phone); setDialog(null);
    try { const res = await request('get_history', { with: u.phone }); setConversations((p) => ({ ...p, [res.roomId]: res.messages })); }
    catch (e) { notice(e.message); }
  }, [request, notice]);

  useEffect(() => {
    const handler = () => { unlockAudio(); };
    document.addEventListener('pointerdown', handler, { once: true });
    return () => { document.removeEventListener('pointerdown', handler); clearTimeout(toastTimer.current); };
  }, []);
  useEffect(() => {
    if (!me?.token) return;
    const socket = createSocket(); socketRef.current = socket;
    const updateMessage = (msg) => setConversations((p) => ({ ...p, [msg.roomId]: merge(p[msg.roomId], [msg]) }));
    socket.on('connect', () => {
      socket.timeout(15000).emit('register', { token: me.token, name: me.name }, (err, res) => {
        if (err) { setConnected(false); notice('Could not sync chats. Reconnecting…'); socket.disconnect().connect(); return; }
        if (!res?.ok) { setAuthError(res?.error || 'Please sign in again'); localStorage.removeItem(USER_KEY); setMe(null); return; }
        knownIds.current = new Set(Object.values(res.conversations || {}).flat().map((m) => m.id));
        setUsers(res.users || []); setGroups(res.groups || []); setConversations(res.conversations || {});
        setPreferences({ ...defaultPrefs, ...res.preferences }); setStatuses(res.statuses || []); setCalls(res.calls || []); setConnected(true);
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') enablePush().catch(() => {});
        setMe((p) => { const next = { ...p, ...res.user }; localStorage.setItem(USER_KEY, JSON.stringify(next)); return next; });
        const queryPhone = new URLSearchParams(window.location.search).get('chat');
        if (queryPhone && [...res.users, ...res.groups].some((u) => u.phone === queryPhone)) setSelectedId(queryPhone);
      });
    });
    socket.on('disconnect', () => { setConnected(false); endCall(true); });
    socket.on('connect_error', () => setConnected(false));
    socket.on('users', (list) => setUsers(list));
    socket.on('groups', (list) => {
      setGroups(list);
      setConversations((p) => Object.fromEntries(Object.entries(p).filter(([rid]) => !rid.startsWith('group:') || list.some((g) => g.phone === rid))));
      const id = latest.current.selectedId;
      if (id?.startsWith('group:') && !list.some((g) => g.phone === id)) { setSelectedId(null); setDialog(null); notice('You are no longer a member of this group.'); }
    });
    socket.on('preferences', (p) => setPreferences({ ...defaultPrefs, ...p }));
    socket.on('profile', (user) => setMe((p) => { const next = { ...p, ...user }; localStorage.setItem(USER_KEY, JSON.stringify(next)); return next; }));
    socket.on('statuses', setStatuses); socket.on('calls', setCalls);
    socket.on('message_updated', updateMessage);
    socket.on('message', (msg) => {
      updateMessage(msg);
      if (knownIds.current.has(msg.id)) return;
      knownIds.current.add(msg.id);
      const state = latest.current;
      if (msg.from === me.phone) return;
      const targetId = msg.to.startsWith('group:') ? msg.to : msg.from;
      const active = state.selectedId === targetId && document.visibilityState === 'visible' && document.hasFocus();
      if (active || state.preferences.muted.includes(targetId) || (!msg.to.startsWith('group:') && state.preferences.blocked.includes(msg.from))) return;
      const target = [...state.users, ...state.groups].find((u) => u.phone === targetId);
      const senderName = target?.name || msg.fromName;
      const preview = `${msg.to.startsWith('group:') ? `${msg.fromName}: ` : ''}${shortPreview(msg)}`;
      playSound();
      showBrowserNotification({ title: senderName, body: preview, tag: `chat-${msg.roomId}`, force: true, chatUrl: `/?chat=${encodeURIComponent(targetId)}`, onClick: () => setSelectedId(targetId) });
      if (document.visibilityState === 'visible') {
        clearTimeout(toastTimer.current); setToast({ from: senderName, preview, time: '', canReply: true, _raw: msg, targetId });
        toastTimer.current = setTimeout(() => setToast(null), 6000);
      }
    });
    socket.on('chat_cleared', ({ roomId: rid }) => setConversations((p) => ({ ...p, [rid]: [] })));
    socket.on('messages_expired', ({ roomId: rid, ids }) => setConversations((p) => ({ ...p, [rid]: (p[rid] || []).filter((m) => !ids.includes(m.id)) })));
    socket.on('typing', (data) => {
      const key = `${data.roomId}/${data.from}`;
      clearTimeout(typingTimers.current[key]);
      setTyping((p) => ({ ...p, [key]: data.isTyping ? data : null }));
      if (data.isTyping) typingTimers.current[key] = setTimeout(() => setTyping((p) => ({ ...p, [key]: null })), 4000);
    });
    socket.on('incoming_call', (data) => {
      if (callRef.current) { socket.emit('call_reject', { callId: data.callId }); return; }
      const c = { type: data.type, peer: data.from, peerName: data.fromName, state: 'incoming', callId: data.callId, isIncoming: true, _offer: data.offer };
      callRef.current = c; setCall(c);
      if (document.visibilityState !== 'visible') showBrowserNotification({ title: data.fromName, body: `Incoming ${data.type === 'video' ? 'video' : 'voice'} call`, tag: `call-${data.callId}`, force: true, chatUrl: `/?chat=${data.from}` });
    });
    socket.on('call_answer', async ({ answer, callId }) => {
      if (sessionRef.current?.callId !== callId) return;
      try { await sessionRef.current.acceptAnswer(answer); setCall((c) => c && c.state !== 'connected' ? { ...c, state: 'connecting' } : c); }
      catch { notice('Could not connect the call'); endCall(); }
    });
    socket.on('call_ice', ({ candidate, callId }) => {
      if (sessionRef.current?.callId === callId) sessionRef.current.addIce(candidate);
      else if (callRef.current?.callId === callId) iceQueue.current.set(callId, [...(iceQueue.current.get(callId) || []), candidate]);
    });
    for (const event of ['call_ended', 'call_rejected']) socket.on(event, ({ callId, reason }) => {
      if (callRef.current?.callId !== callId) return;
      endCall(true);
      if (reason === 'missed') notice('No answer. Call ended.');
      if (reason === 'declined') notice('Call declined');
      if (reason === 'interrupted') notice('Call ended because the connection was lost.');
    });
    return () => { socket.disconnect(); socketRef.current = null; endCall(true); Object.values(typingTimers.current).forEach(clearTimeout); };
  }, [me?.token, notice, endCall]);

  const allChats = useMemo(() => [
    ...users.filter((u) => u.phone !== me?.phone),
    ...(me ? [{ ...users.find((u) => u.phone === me.phone), phone: me.phone, name: 'Message yourself', isSelf: true, about: 'Your private notes and reminders' }] : []), ...groups,
  ], [users, groups, me?.phone]);
  const unread = useMemo(() => Object.fromEntries(Object.entries(conversations).map(([rid, list]) => [rid, list.filter((m) => m.from !== me?.phone && !m.deleted && !m.deletedFor?.includes(me?.phone) && !m.readBy?.includes(me?.phone)).length])), [conversations, me?.phone]);
  const activeMessages = useMemo(() => (conversations[roomId(me?.phone, selectedId)] || []).filter((m) => !m.deletedFor?.includes(me?.phone)), [conversations, selectedId, me?.phone]);
  const lastMessages = useMemo(() => Object.fromEntries(allChats.map((u) => [u.phone, (conversations[roomId(me?.phone, u.phone)] || []).filter((m) => !m.deletedFor?.includes(me?.phone)).at(-1)])), [allChats, conversations, me?.phone]);
  useEffect(() => { setUnreadTotal(Object.values(unread).reduce((a, n) => a + n, 0)); }, [unread]);
  useEffect(() => {
    const read = () => {
      if (!connected || !selectedId || document.visibilityState !== 'visible' || !document.hasFocus()) return;
      const ids = activeMessages.filter((m) => m.from !== me.phone && !m.readBy?.includes(me.phone)).map((m) => m.id);
      if (ids.length) socketRef.current?.emit('seen', { roomId: roomId(me.phone, selectedId), ids });
    };
    read(); window.addEventListener('focus', read); document.addEventListener('visibilitychange', read);
    return () => { window.removeEventListener('focus', read); document.removeEventListener('visibilitychange', read); };
  }, [activeMessages, selectedId, connected, me?.phone]);
  useEffect(() => {
    const handler = (e) => { if (e.data?.type === 'OPEN_CHAT' && /^(\d{10}|group:[a-f0-9-]{36})$/.test(e.data.chat || '')) setSelectedId(e.data.chat); };
    navigator.serviceWorker?.addEventListener('message', handler);
    return () => navigator.serviceWorker?.removeEventListener('message', handler);
  }, []);

  const sendTo = async (targetId, payload) => {
    const { files, ...rest } = payload;
    if (files?.length > 1) {
      const batch = payload.clientId || newId();
      for (let i = 0; i < files.length; i++) await request('send_message', { to: targetId, ...rest, text: i ? '' : rest.text, file: files[i], clientId: `${batch}-${i}` });
    } else await request('send_message', { to: targetId, ...rest, clientId: payload.clientId || newId() });
  };
  const send = async (payload) => { await sendTo(latest.current.selectedId, payload); };
  const setPref = (key, value) => request('preferences', { key, value, enabled: !preferences[key].includes(value) }).catch((e) => notice(e.message));
  const deleteMessage = (m, forEveryone) => request('delete_message', { roomId: m.roomId, messageId: m.id, forEveryone }).catch((e) => notice(e.message));
  const chatAction = async (action) => {
    if (!selected) return;
    const id = selected.phone;
    if (['mute', 'favorite', 'pin', 'archive', 'block'].includes(action)) {
      const key = { mute: 'muted', favorite: 'favorites', pin: 'pinned', archive: 'archived', block: 'blocked' }[action];
      if (action === 'block' && !preferences.blocked.includes(id)) setConfirm({ title: `Block ${selected.name}?`, message: 'You will no longer exchange direct messages or calls with this contact.', run: () => setPref(key, id) });
      else await setPref(key, id);
    } else if (['contact', 'media', 'starred'].includes(action)) setDialog({ type: action, user: selected });
    else if (action === 'disappearing') setDialog({ type: 'timer', user: selected });
    else if (['clear', 'delete'].includes(action)) setConfirm({ title: action === 'clear' ? 'Clear chat?' : 'Delete chat?', message: 'Messages will be removed for you. Other members keep their copies.', run: async () => { await request('clear_chat', { with: id, hide: action === 'delete' }); if (action === 'delete') setSelectedId(null); } });
    else if (action === 'export') {
      const content = activeMessages.map((m) => `[${new Date(m.time).toLocaleString()}] ${m.fromName}: ${m.deleted ? 'Message deleted' : m.text || ''}${m.file ? ` [${m.file.name}] ${m.file.url}` : ''}${m.voice ? ` [Voice] ${m.voice.url}` : ''}${m.gif ? ` [GIF] ${m.gif.url}` : ''}`).join('\n');
      const url = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }));
      const a = document.createElement('a'); a.href = url; a.download = `PulseChat-${selected.name.replace(/[^a-z0-9]/gi, '_')}.txt`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } else if (action === 'share') {
      try { await navigator.clipboard.writeText(`${location.origin}/?chat=${encodeURIComponent(id)}`); notice('Chat link copied'); } catch { notice('Clipboard unavailable. Open contact info to copy the phone number.'); }
    }
  };

  const makeSession = (c, pendingIce) => new CallSession({
    callId: c.callId, peerId: c.peer, type: c.type,
    onIce: (candidate) => { if (pendingIce.ready) socketRef.current?.emit('call_ice', { candidate, callId: c.callId }); else pendingIce.candidates.push(candidate); },
    onRemoteStream: setRemoteStream,
    onConnected: () => setCall((p) => p?.callId === c.callId ? { ...p, state: 'connected', connectedAt: p.connectedAt || Date.now() } : p),
    onEnded: () => { if (callRef.current?.callId === c.callId) { notice('Call connection ended'); endCall(); } },
  });
  const startCall = async (type, target = selected) => {
    if (!target || target.isGroup || target.phone === me.phone) return;
    if (callRef.current) { notice('End your current call first'); return; }
    if (!connected || !target.online || preferences.blocked.includes(target.phone)) { notice('This contact is unavailable for a call'); return; }
    const c = { type, peer: target.phone, peerName: target.name, state: 'preparing', callId: newId(), isIncoming: false };
    callRef.current = c; setCall(c);
    const pendingIce = { ready: false, candidates: [] };
    const session = makeSession(c, pendingIce); sessionRef.current = session;
    try {
      const local = await session.startLocal();
      if (callRef.current?.callId !== c.callId) { session.destroy(); return; }
      setLocalStream(local); const offer = await session.createOffer();
      if (callRef.current?.callId !== c.callId) return;
      await request('call_user', { to: c.peer, type, offer, callId: c.callId });
      if (callRef.current?.callId !== c.callId) { socketRef.current?.emit('call_end', { callId: c.callId }); return; }
      pendingIce.ready = true; pendingIce.candidates.forEach((candidate) => socketRef.current?.emit('call_ice', { candidate, callId: c.callId }));
      setCall((p) => p ? { ...p, state: 'calling' } : p);
    } catch (e) { notice(e.message || 'Could not access microphone or camera'); if (callRef.current?.callId === c.callId) endCall(); else session.destroy(); }
  };
  const acceptCall = async () => {
    const c = callRef.current;
    if (!c || c.state !== 'incoming') return;
    callRef.current = { ...c, state: 'connecting' }; setCall(callRef.current);
    const pendingIce = { ready: true, candidates: [] }, session = makeSession(c, pendingIce); sessionRef.current = session;
    try {
      const local = await session.startLocal();
      if (callRef.current?.callId !== c.callId) { session.destroy(); return; }
      setLocalStream(local);
      for (const candidate of iceQueue.current.get(c.callId) || []) await session.addIce(candidate);
      iceQueue.current.delete(c.callId);
      const answer = await session.acceptOffer(c._offer);
      if (callRef.current?.callId !== c.callId) return;
      await request('call_answer', { answer, callId: c.callId });
    } catch (e) { notice(e.message || 'Could not answer call'); socketRef.current?.emit('call_reject', { callId: c.callId }); endCall(true); session.destroy(); }
  };
  const logout = async () => {
    endCall();
    try { await fetch(`${SOCKET_URL}/api/logout`, { method: 'POST', headers: authHeaders(), signal: AbortSignal.timeout(5000) }); } catch { /* Local logout still works offline. */ }
    socketRef.current?.disconnect(); localStorage.removeItem(USER_KEY); setMe(null); setSelectedId(null); setConversations({}); setUsers([]); setGroups([]); setPreferences(defaultPrefs); setToast(null); setDialog(null); setUnreadTotal(0);
  };
  if (!me) return <Login error={authError} onJoin={(u) => { localStorage.setItem(USER_KEY, JSON.stringify(u)); setMe(u); setAuthError(''); }} />;
  const typingPeople = Object.values(typing).filter((t) => t?.roomId === roomId(me.phone, selectedId));
  return <div className="h-[100dvh] flex overflow-hidden">
    <div className={`${selected ? 'hidden md:flex' : 'flex'} w-full md:w-auto md:shrink-0`}><Sidebar me={me} users={allChats} selected={selected} onSelect={select} lastMessages={lastMessages} unread={unread} connected={connected} preferences={preferences} onLogout={logout} onFeature={(type) => setDialog({ type })} /></div>
    <div className={`${selected ? 'flex' : 'hidden md:flex'} flex-1 min-w-0 w-full`}><ChatWindow key={selectedId || 'empty'} me={me.phone} user={selected} messages={activeMessages} typing={typingPeople.length ? typingPeople.map((p) => p.fromName).join(', ') : ''} muted={preferences.muted.includes(selectedId)} favorite={preferences.favorites.includes(selectedId)} preferences={preferences} connected={connected} onSend={send} onTyping={(isTyping) => { if (socketRef.current?.connected) socketRef.current.emit('typing', { to: selectedId, isTyping }); }} onBack={() => setSelectedId(null)} onVoiceCall={() => startCall('audio')} onVideoCall={() => startCall('video')} onDeleteMessage={deleteMessage} onReactMessage={(m, emoji) => request('react_message', { roomId: m.roomId, messageId: m.id, emoji }).catch((e) => notice(e.message))} onEditMessage={(message) => setDialog({ type: 'edit', message })} onForwardMessage={(message) => setDialog({ type: 'forward', message })} onForwardMany={(messages) => setDialog({ type: 'forward', messages })} onStarMessage={(m) => setPref('starred', m.id)} onAction={(key) => { chatAction(key).catch((e) => notice(e.message)); }} /></div>
    <Toast toast={toast} onClose={() => setToast(null)} onOpen={() => { if (toast?.targetId) setSelectedId(toast.targetId); setToast(null); }} onReply={(text) => sendTo(toast.targetId, { text }).catch((e) => notice(e.message))} />
    <NotificationPrompt />
    {call && <CallModal key={call.callId} call={call} localStream={localStream} remoteStream={remoteStream} isIncoming={call.state === 'incoming'} onAccept={acceptCall} onReject={() => { socketRef.current?.emit('call_reject', { callId: call.callId }); endCall(true); }} onEnd={() => endCall()} />}
    {dialog && <FeatureDialog key={`${dialog.type}/${dialog.message?.id || dialog.user?.phone || ''}`} dialog={dialog} onClose={() => setDialog(null)} me={me} users={users} groups={groups} statuses={statuses} calls={calls} messages={dialog.user ? conversations[roomId(me.phone, dialog.user.phone)] || [] : Object.values(conversations).flat().filter((m) => !m.deletedFor?.includes(me.phone))} preferences={preferences} request={request} onSelect={select} onCall={startCall} onNotice={notice} onForward={async (u, list) => { for (const m of list) await sendTo(u.phone, { text: m.text, file: m.file, voice: m.voice, gif: m.gif, forwarded: true }); await select(u); }} />}
    <ConfirmDialog open={!!confirm} title={confirm?.title} message={confirm?.message} danger confirmLabel="Confirm" onCancel={() => setConfirm(null)} onConfirm={async () => { try { await confirm.run(); setConfirm(null); } catch (e) { notice(e.message); } }} />
  </div>;
}
