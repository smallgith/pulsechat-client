import { useCallback, useEffect, useRef, useState } from 'react';
import { CallSession } from '../lib/webrtc';
import { captureCallMedia, releaseCallMedia } from '../lib/microphone';
import { showBrowserNotification } from '../lib/notification';

// Small-group mesh calling (4 participants maximum). The backend checks group membership
// for every join and every signal; a larger production conference requires an SFU.
export function useGroupCalls({ connected, socketRef, request, me, notice, directCallRef }) {
  const [call, setCall] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [remotes, setRemotes] = useState({});
  const active = useRef(null);
  const local = useRef(null);
  const sessions = useRef(new Map());
  const pendingIce = useRef(new Map());

  const close = useCallback(() => {
    for (const session of sessions.current.values()) session.destroy();
    sessions.current.clear();
    pendingIce.current.clear();
    releaseCallMedia(local.current);
    local.current = null;
    active.current = null;
    setCall(null);
    setLocalStream(null);
    setRemotes({});
  }, []);

  const signal = useCallback((to, data) => {
    const info = active.current;
    if (info?.callId) socketRef.current?.emit('group_call_signal', {
      to, callId: info.callId, ...data,
    });
  }, [socketRef]);

  const ensurePeer = useCallback((phone) => {
    if (sessions.current.has(phone)) return sessions.current.get(phone);
    const info = active.current;
    if (!local.current || !info) throw new Error('Call is not active');
    const session = new CallSession({
      callId: info.callId, peerId: phone, type: info.type,
      onIce: candidate => signal(phone, { candidate }),
      onRemoteStream: stream => setRemotes(previous => ({ ...previous, [phone]: stream })),
      onEnded: () => {
        const current = sessions.current.get(phone);
        if (current !== session) return;
        sessions.current.delete(phone);
        session.destroy();
        setRemotes(previous => { const next = { ...previous }; delete next[phone]; return next; });
      },
    });
    session.localStream = local.current;
    session.ownsLocal = false;
    sessions.current.set(phone, session);
    return session;
  }, [signal]);

  const startMedia = async (type) => {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Microphone/camera needs HTTPS and permission.');
    const stream = await captureCallMedia(type === 'video' ? { width: { ideal: 640 }, height: { ideal: 480 } } : false);
    local.current = stream;
    setLocalStream(stream);
  };

  const start = async (group, type) => {
    if (!connected || active.current) throw new Error('Finish the current call first.');
    try {
      await startMedia(type);
      const result = await request('group_call_start', { groupId: group.phone, type });
      const info = { callId: result.callId, groupId: group.phone, groupName: group.name, type, state: 'active' };
      active.current = info; setCall(info);
    } catch (error) { close(); throw error; }
  };

  const answer = async () => {
    const invite = active.current;
    if (!invite || invite.state !== 'incoming') return;
    try {
      await startMedia(invite.type);
      const result = await request('group_call_join', { callId: invite.callId });
      const info = { ...invite, state: 'active', groupName: result.groupName };
      active.current = info; setCall(info);
      for (const phone of result.participants) {
        const peer = ensurePeer(phone);
        const offer = await peer.createOffer();
        signal(phone, { description: offer });
      }
    } catch (error) { close(); throw error; }
  };

  const leave = () => {
    if (active.current?.state === 'active') {
      socketRef.current?.emit('group_call_leave', { callId: active.current.callId });
    }
    close();
  };

  useEffect(() => {
    if (!connected || !socketRef.current) return;
    const socket = socketRef.current;
    const invite = data => {
      if (active.current || directCallRef?.current || !data?.callId) return;
      const info = { ...data, state: 'incoming' };
      active.current = info; setCall(info);
      if (document.visibilityState !== 'visible') {
        showBrowserNotification({ title: `${data.groupName} · group call`,
          body: `Incoming ${data.type === 'video' ? 'video' : 'voice'} group call`,
          tag: `call-${data.callId}`, force: true,
          chatUrl: `/?chat=${encodeURIComponent(data.groupId)}`, });
      }
    };
    const received = async ({ callId, from, description, candidate }) => {
      if (active.current?.state !== 'active' || active.current.callId !== callId || !from) return;
      try {
        if (candidate && !description && !sessions.current.has(from)) {
          pendingIce.current.set(from, [...(pendingIce.current.get(from) || []), candidate].slice(-96));
          return;
        }
        const peer = ensurePeer(from);
        if (description?.type === 'offer') {
          const answer = await peer.acceptOffer(description);
          signal(from, { description: answer });
        } else if (description?.type === 'answer') await peer.acceptAnswer(description);
        if (candidate) await peer.addIce(candidate);
        for (const c of pendingIce.current.get(from) || []) await peer.addIce(c);
        pendingIce.current.delete(from);
      } catch (error) { notice(`Group call connection failed: ${error.message}`); }
    };
    const left = ({ callId, phone }) => {
      if (active.current?.callId !== callId) return;
      sessions.current.get(phone)?.destroy();
      sessions.current.delete(phone);
      pendingIce.current.delete(phone);
      setRemotes(previous => { const next = { ...previous }; delete next[phone]; return next; });
    };
    const ended = ({ callId }) => { if (active.current?.callId === callId) close(); };
    const disconnected = () => close();
    socket.on('group_call_invite', invite);
    socket.on('group_call_signal', received);
    socket.on('group_call_peer_left', left);
    socket.on('group_call_ended', ended);
    socket.on('disconnect', disconnected);
    return () => {
      socket.off('group_call_invite', invite);
      socket.off('group_call_signal', received);
      socket.off('group_call_peer_left', left);
      socket.off('group_call_ended', ended);
      socket.off('disconnect', disconnected);
    };
  }, [connected, me?.phone, socketRef, ensurePeer, signal, notice, close, directCallRef]);

  useEffect(() => () => close(), [close]);
  return { call, activeRef: active, localStream, remotes, start, answer, leave };
}
