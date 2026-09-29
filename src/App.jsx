import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Login from './components/Login';
import Sidebar from './components/Sidebar';
import ChatWindow from './components/ChatWindow';
import Toast from './components/Toast';
import NotificationPrompt from './components/NotificationPrompt';
import CallModal from './components/CallModal';
import ConfirmDialog from './components/ConfirmDialog';
import { createSocket, roomId } from './lib/socket';
import { CallSession } from './lib/webrtc';
import {
  playSound,
  setBaseTitle,
  setUnreadTotal,
  showBrowserNotification,
} from './lib/notification';

const USER_KEY = 'pulsechat.user'; // JSON { phone, name }

const mergeById = (a = [], b = []) => {
  const map = new Map();
  [...a, ...b].forEach((m) => map.set(m.id, m));
  return [...map.values()].sort((x, y) => new Date(x.time) - new Date(y.time));
};

export default function App() {
  const [me, setMe] = useState(() => {
    try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); }
    catch { return null; }
  });
  const [authError, setAuthError] = useState('');
  const [connected, setConnected] = useState(false);

  const [users, setUsers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [conversations, setConversations] = useState({});
  const [unread, setUnread] = useState({});
  const [typingFrom, setTypingFrom] = useState(null);
  const [muted, setMuted] = useState(new Set());
  const [favorites, setFavorites] = useState(new Set());

  /* ---------- toast ---------- */
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  /* ---------- call state ---------- */
  const [call, setCall] = useState(null);       // { type, peer, peerName, state, callId, isIncoming }
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const sessionRef = useRef(null);
  const callRef = useRef(null);

  /* ---------- delete chat confirm ---------- */
  const [confirm, setConfirm] = useState(null);

  const socketRef = useRef(null);
  const selectedRef = useRef(null);
  const usersRef = useRef([]);
  const meRef = useRef(null);

  /* ================= title + favicon ================= */
  useEffect(() => { setBaseTitle('PulseChat'); }, []);

  useEffect(() => {
    const total = Object.values(unread).reduce((s, n) => s + n, 0);
    setUnreadTotal(total);
  }, [unread]);

  useEffect(() => { selectedRef.current = selected; }, [selected]);
  useEffect(() => { usersRef.current = users; }, [users]);
  useEffect(() => { meRef.current = me; }, [me]);
  useEffect(() => { callRef.current = call; }, [call]);

  /* ================= audio unlock ================= */
  useEffect(() => {
    const unlock = async () => {
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        if (ctx.state === 'suspended') await ctx.resume();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        gain.gain.value = 0.0001;
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(0); osc.stop(0.01);
        setTimeout(() => ctx.close(), 100);
      } catch {}
      document.removeEventListener('click', unlock);
      document.removeEventListener('keydown', unlock);
      document.removeEventListener('touchstart', unlock);
    };
    document.addEventListener('click', unlock, { once: true });
    document.addEventListener('keydown', unlock, { once: true });
    document.addEventListener('touchstart', unlock, { once: true });
    return () => {
      document.removeEventListener('click', unlock);
      document.removeEventListener('keydown', unlock);
      document.removeEventListener('touchstart', unlock);
    };
  }, []);

  /* ================= toast helper ================= */
  const pushToast = useCallback((data) => {
    clearTimeout(toastTimer.current);
    setToast(data);
    toastTimer.current = setTimeout(() => setToast(null), 5000);
  }, []);

  /* ================= socket ================= */
  useEffect(() => {
    if (!me?.phone) return;

    const socket = createSocket();
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('register', { phone: me.phone, name: me.name }, (res) => {
        if (!res?.ok) {
          setAuthError(res?.error || 'Could not join');
          localStorage.removeItem(USER_KEY);
          setMe(null);
        } else {
          setAuthError('');
          setMuted(new Set(res.muted || []));
          setFavorites(new Set(res.favorites || []));
        }
      });
    });

    socket.on('disconnect', () => setConnected(false));
    socket.on('force_logout', () => {
      localStorage.removeItem(USER_KEY);
      setMe(null);
    });

    socket.on('users', (list) => {
      setUsers(list.filter((u) => u.phone !== me.phone));
    });

    socket.on('mute_list', (arr) => setMuted(new Set(arr)));
    socket.on('favorite_list', (arr) => setFavorites(new Set(arr)));

    /* --------- MESSAGE --------- */
    socket.on('message', (msg) => {
      const rid = msg.roomId || roomId(msg.from, msg.to);
      let isNew = false;
      setConversations((prev) => {
        const list = prev[rid] || [];
        if (list.some((m) => m.id === msg.id)) return prev;
        isNew = true;
        return { ...prev, [rid]: [...list, msg] };
      });
      if (msg.from === me.phone || !isNew) return;

      const active = selectedRef.current;
      const isActiveChat = active?.phone === msg.from;
      const isFocused = document.visibilityState === 'visible' && document.hasFocus();
      const isTabVisible = document.visibilityState === 'visible';
      const isMuted = muted.has(msg.from);

      if (isActiveChat && isFocused) {
        socket.emit('seen', { to: msg.from, roomId: rid });
        return;
      }

      setUnread((prev) => ({ ...prev, [rid]: (prev[rid] || 0) + 1 }));

      if (!isMuted) playSound();

      const preview = msg.deleted
        ? '🚫 Deleted'
        : msg.voice
          ? '🎤 Voice message'
          : msg.gif
            ? '🎬 GIF'
            : msg.file
              ? msg.file.mime?.startsWith('image/')
                ? `📷 ${msg.text || 'Photo'}`
                : msg.file.mime?.startsWith('video/')
                  ? `🎥 ${msg.text || 'Video'}`
                  : `📎 ${msg.file.name}`
              : msg.text || 'New message';

      const sender = usersRef.current.find((u) => u.phone === msg.from);
      const senderName = sender?.name || msg.fromName || msg.from;

      const openChat = () => {
        setSelected(sender || { phone: msg.from, name: senderName, joinedAt: Date.now() });
        setUnread((prev) => {
          const n = { ...prev };
          delete n[rid];
          return n;
        });
      };

      const shouldShowDesktop = !isActiveChat || !isTabVisible;
      if (shouldShowDesktop && !isMuted) {
        showBrowserNotification({
          title: `💬 ${senderName}`,
          body: preview,
          tag: `chat-${rid}`,
          force: true,
          onClick: openChat,
        });
      }

      if (isTabVisible && !isActiveChat) {
        pushToast({
          from: senderName,
          preview,
          time: new Date(msg.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          canReply: true,
          _raw: msg,
        });
      }
    });

    socket.on('message_updated', (msg) => {
      const rid = msg.roomId;
      setConversations((prev) => {
        const list = prev[rid];
        if (!list) return prev;
        return { ...prev, [rid]: list.map((m) => (m.id === msg.id ? msg : m)) };
      });
    });

    socket.on('chat_cleared', ({ roomId: rid }) => {
      setConversations((prev) => {
        if (!prev[rid]) return prev;
        return {
          ...prev,
          [rid]: prev[rid].map((m) => ({ ...m, deletedFor: [...(m.deletedFor || []), me.phone] })),
        };
      });
    });

    socket.on('typing', ({ from, isTyping }) => {
      setTypingFrom((prev) => {
        if (isTyping) return { from };
        return prev?.from === from ? null : prev;
      });
    });

    socket.on('seen', ({ roomId: rid }) => {
      setConversations((prev) => {
        const list = prev[rid];
        if (!list) return prev;
        return {
          ...prev,
          [rid]: list.map((m) => m.from === me.phone ? { ...m, status: 'seen' } : m),
        };
      });
    });

    /* --------- CALL signaling --------- */
    socket.on('incoming_call', ({ from, fromName, type, offer, callId }) => {
      if (callRef.current) {
        // already in a call → reject
        socket.emit('call_reject', { to: from, callId });
        return;
      }
      const sender = usersRef.current.find((u) => u.phone === from);
      setCall({
        type,
        peer: from,
        peerName: sender?.name || fromName || from,
        state: 'incoming',
        callId,
        isIncoming: true,
        _offer: offer,
      });
    });

    socket.on('call_answer', async ({ answer, callId }) => {
      const s = sessionRef.current;
      if (!s || s.callId !== callId) return;
      try {
        await s.acceptAnswer(answer);
        setCall((c) => (c ? { ...c, state: 'connected' } : c));
      } catch (e) { console.error(e); }
    });

    socket.on('call_ice', async ({ candidate, callId }) => {
      const s = sessionRef.current;
      if (!s || s.callId !== callId) return;
      await s.addIce(candidate);
    });

    socket.on('call_rejected', () => {
      endCall(true);
      pushToast({ from: 'Call', preview: 'Call declined', time: '' });
    });

    socket.on('call_ended', () => {
      endCall(true);
      pushToast({ from: 'Call', preview: 'Call ended', time: '' });
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.phone]);

  /* ================= seen on focus ================= */
  useEffect(() => {
    const onFocus = () => {
      const active = selectedRef.current;
      const m = meRef.current;
      if (active && m && document.visibilityState === 'visible') {
        const rid = roomId(m.phone, active.phone);
        socketRef.current?.emit('seen', { to: active.phone, roomId: rid });
        setUnread((prev) => {
          if (!prev[rid]) return prev;
          const n = { ...prev }; delete n[rid]; return n;
        });
      }
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  /* ================= select user ================= */
  const handleSelect = useCallback((user) => {
    setSelected(user);
    setTypingFrom(null);
    const rid = roomId(me.phone, user.phone);
    setUnread((prev) => {
      if (!prev[rid]) return prev;
      const n = { ...prev }; delete n[rid]; return n;
    });
    const socket = socketRef.current;
    if (!socket) return;
    socket.emit('get_history', { with: user.phone }, (res) => {
      if (!res) return;
      setConversations((prev) => ({
        ...prev,
        [res.roomId]: mergeById(prev[res.roomId], res.messages),
      }));
    });
    socket.emit('seen', { to: user.phone, roomId: rid });
  }, [me?.phone]);

  /* ================= send ================= */
  const handleSend = useCallback((payload) => {
    const target = selectedRef.current;
    if (!target || !socketRef.current) return;
    socketRef.current.emit('send_message', { to: target.phone, ...payload });
  }, []);

  const handleTyping = useCallback((isTyping) => {
    const target = selectedRef.current;
    if (!target) return;
    socketRef.current?.emit('typing', { to: target.phone, isTyping });
  }, []);

  /* ================= delete message ================= */
  const handleDeleteMessage = useCallback((msg, forEveryone) => {
    if (!socketRef.current) return;
    socketRef.current.emit('delete_message', {
      roomId: msg.roomId,
      messageId: msg.id,
      forEveryone,
    }, (res) => {
      if (res?.ok) {
        pushToast({
          from: 'Message',
          preview: forEveryone ? 'Deleted for everyone' : 'Deleted for you',
          time: '',
        });
      }
    });
  }, [pushToast]);

  /* ================= react ================= */
  const handleReactMessage = useCallback((msg, emoji) => {
    socketRef.current?.emit('react_message', {
      roomId: msg.roomId,
      messageId: msg.id,
      emoji,
    });
  }, []);

  /* ================= quick reply ================= */
  const handleQuickReply = useCallback((text) => {
    if (!toast?._raw || !socketRef.current) return;
    socketRef.current.emit('send_message', { to: toast._raw.from, text });
  }, [toast]);

  /* ================= CHAT MENU ACTIONS ================= */
  const handleChatAction = (key) => {
    const user = selectedRef.current;
    if (!user) return;
    const socket = socketRef.current;

    switch (key) {
      case 'mute':
        {
          const isMuted = muted.has(user.phone);
          socket?.emit('toggle_mute', { with: user.phone, muted: !isMuted });
          pushToast({ from: 'Chat', preview: isMuted ? 'Unmuted' : 'Muted', time: '' });
        }
        break;
      case 'favorite':
        {
          const isFav = favorites.has(user.phone);
          socket?.emit('toggle_favorite', { with: user.phone, favorite: !isFav });
          pushToast({ from: 'Chat', preview: isFav ? 'Removed from favourites' : 'Added to favourites', time: '' });
        }
        break;
      case 'clear':
        setConfirm({
          title: 'Clear chat?',
          message: 'All messages will be removed for you.',
          onConfirm: () => {
            socket?.emit('clear_chat', { with: user.phone });
            setConfirm(null);
            pushToast({ from: 'Chat', preview: 'Chat cleared', time: '' });
          },
        });
        break;
      case 'delete':
        setConfirm({
          title: 'Delete chat?',
          message: 'This will remove the chat from your list.',
          onConfirm: () => {
            socket?.emit('clear_chat', { with: user.phone });
            setSelected(null);
            setConfirm(null);
            pushToast({ from: 'Chat', preview: 'Chat deleted', time: '' });
          },
        });
        break;
      case 'block':
        pushToast({ from: 'Chat', preview: 'Block feature coming soon', time: '' });
        break;
      case 'report':
        pushToast({ from: 'Chat', preview: 'Report submitted', time: '' });
        break;
      case 'contact':
        pushToast({ from: 'Contact', preview: `${user.name || user.phone}`, time: '' });
        break;
      case 'disappearing':
        pushToast({ from: 'Chat', preview: 'Disappearing messages: coming soon', time: '' });
        break;
      case 'call_link':
        {
          const link = `${window.location.origin}/?call=${user.phone}`;
          navigator.clipboard.writeText(link);
          pushToast({ from: 'Call', preview: 'Call link copied', time: '' });
        }
        break;
      case 'schedule':
      case 'group_call':
      case 'list':
        pushToast({ from: 'Chat', preview: `${key} coming soon`, time: '' });
        break;
      default:
        break;
    }
  };

  /* ================= CALLS ================= */
  const startCall = async (type) => {
    const target = selectedRef.current;
    if (!target || !socketRef.current) return;

    const callId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const session = new CallSession({
      socket: socketRef.current,
      callId,
      peerId: target.phone,
      type,
      onIce: (candidate) =>
        socketRef.current.emit('call_ice', { to: target.phone, candidate, callId }),
      onRemoteStream: (stream) => setRemoteStream(stream),
      onEnded: () => endCall(true),
    });

    try {
      const local = await session.startLocal();
      setLocalStream(local);
      const offer = await session.createOffer();
      sessionRef.current = session;

      setCall({
        type,
        peer: target.phone,
        peerName: target.name,
        state: 'calling',
        callId,
        isIncoming: false,
      });

      socketRef.current.emit('call_user', {
        to: target.phone,
        type,
        offer,
        callId,
      });
    } catch (e) {
      console.error(e);
      pushToast({ from: 'Call', preview: 'Could not access mic/camera', time: '' });
      session.destroy();
    }
  };

  const acceptCall = async () => {
    const c = callRef.current;
    if (!c || !socketRef.current) return;
    const session = new CallSession({
      socket: socketRef.current,
      callId: c.callId,
      peerId: c.peer,
      type: c.type,
      onIce: (candidate) =>
        socketRef.current.emit('call_ice', { to: c.peer, candidate, callId: c.callId }),
      onRemoteStream: (stream) => setRemoteStream(stream),
      onEnded: () => endCall(true),
    });

    try {
      const local = await session.startLocal();
      setLocalStream(local);
      const answer = await session.acceptOffer(c._offer);
      sessionRef.current = session;

      socketRef.current.emit('call_answer', {
        to: c.peer,
        answer,
        callId: c.callId,
      });

      setCall({ ...c, state: 'connected' });
    } catch (e) {
      console.error(e);
      socketRef.current.emit('call_reject', { to: c.peer, callId: c.callId });
      endCall(true);
    }
  };

  const rejectCall = () => {
    const c = callRef.current;
    if (c && socketRef.current) {
      socketRef.current.emit('call_reject', { to: c.peer, callId: c.callId });
    }
    endCall(true);
  };

  const endCall = (remote = false) => {
    const c = callRef.current;
    if (c && socketRef.current && !remote) {
      socketRef.current.emit('call_end', { to: c.peer, callId: c.callId });
    }
    sessionRef.current?.destroy();
    sessionRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    setCall(null);
  };

  /* ================= logout ================= */
  const handleLogout = () => {
    socketRef.current?.disconnect();
    localStorage.removeItem(USER_KEY);
    setMe(null);
    setSelected(null);
    setConversations({});
    setUnread({});
    setUsers([]);
    setToast(null);
    setUnreadTotal(0);
    endCall(true);
  };

  const handleJoin = ({ phone, name }) => {
    const u = { phone, name };
    localStorage.setItem(USER_KEY, JSON.stringify(u));
    setMe(u);
  };

  /* ================= derived ================= */
  const lastMessages = useMemo(() => {
    const out = {};
    users.forEach((u) => {
      const rid = roomId(me?.phone, u.phone);
      const list = conversations[rid] || [];
      const visible = list.filter((m) => !m.deletedFor?.includes(me?.phone));
      out[u.phone] = visible[visible.length - 1] || null;
    });
    return out;
  }, [users, conversations, me?.phone]);

  const activeMessages = useMemo(() => {
    if (!selected) return [];
    const list = conversations[roomId(me?.phone, selected.phone)] || [];
    return list.filter((m) => !m.deletedFor?.includes(me?.phone));
  }, [selected, conversations, me?.phone]);

  const typingForSelected = !!(typingFrom && selected && typingFrom.from === selected.phone);

  /* ================= render ================= */
  if (!me?.phone) {
    return <Login onJoin={handleJoin} error={authError} />;
  }

  return (
    <div className="h-full flex overflow-hidden">
      <div className={`${selected ? 'hidden md:flex' : 'flex'} w-full md:w-auto`}>
        <Sidebar
          me={me.name}
          users={users}
          selected={selected}
          onSelect={handleSelect}
          lastMessages={lastMessages}
          unread={unread}
          connected={connected}
          muted={muted}
          favorites={favorites}
          onLogout={handleLogout}
        />
      </div>

      <div className={`${selected ? 'flex' : 'hidden md:flex'} flex-1 min-w-0`}>
        <ChatWindow
          me={me.phone}
          user={selected}
          messages={activeMessages}
          typing={typingForSelected}
          muted={selected ? muted.has(selected.phone) : false}
          favorite={selected ? favorites.has(selected.phone) : false}
          onSend={handleSend}
          onTyping={handleTyping}
          onBack={() => setSelected(null)}
          onVoiceCall={() => startCall('audio')}
          onVideoCall={() => startCall('video')}
          onDeleteMessage={handleDeleteMessage}
          onReactMessage={handleReactMessage}
          onAction={handleChatAction}
        />
      </div>

      <Toast
        toast={toast}
        onClose={() => setToast(null)}
        onOpen={() => {
          if (!toast?._raw) return;
          const sender = users.find((x) => x.phone === toast._raw.from);
          handleSelect(sender || { phone: toast._raw.from, name: toast._raw.from, joinedAt: Date.now() });
          setToast(null);
        }}
        onReply={handleQuickReply}
      />

      <NotificationPrompt />

      {/* Call UI */}
      {call && (
        <CallModal
          call={call}
          localStream={localStream}
          remoteStream={remoteStream}
          isIncoming={call.isIncoming && call.state === 'incoming'}
          onAccept={acceptCall}
          onReject={rejectCall}
          onEnd={() => endCall(false)}
        />
      )}

      {/* Generic confirm dialog for chat menu actions */}
      <ConfirmDialog
        open={!!confirm}
        title={confirm?.title}
        message={confirm?.message}
        confirmLabel="Confirm"
        danger
        onCancel={() => setConfirm(null)}
        onConfirm={() => confirm?.onConfirm?.()}
      />
    </div>
  );
}