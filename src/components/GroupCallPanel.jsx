import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Phone, Users } from 'lucide-react';
import Avatar from './Avatar';

function StreamTile({ stream, name, muted = false, video = false }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.srcObject = stream || null;
    if (stream) el.play().catch(() => {});
    return () => { if (el) el.srcObject = null; };
  }, [stream]);
  return (
    <div className="relative rounded-2xl bg-slate-900 overflow-hidden min-h-36 flex items-center justify-center border border-white/10">
      {video && stream?.getVideoTracks().length ? (
        <video ref={ref} autoPlay playsInline muted={muted} className="w-full h-44 object-cover" />
      ) : (
        <><audio ref={ref} autoPlay playsInline muted={muted} />
          <Avatar size={68} name={name} /></>
      )}
      <p className="absolute bottom-2 left-2 bg-black/60 rounded-full px-3 py-1 text-xs text-white">{name}</p>
    </div>
  );
}

export default function GroupCallPanel({ call, localStream, remotes, onAccept, onLeave, onNotice, users }) {
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  useEffect(() => {
    if (!call || call.state !== 'incoming') return;
    const ringtone = new Audio('/voice-call-rington.mp3');
    ringtone.loop = true; ringtone.volume = .55;
    ringtone.play().catch(() => {});
    return () => { ringtone.pause(); ringtone.currentTime = 0; };
  }, [call?.callId, call?.state]);
  if (!call) return null;
  const incoming = call.state === 'incoming';
  const join = async () => { try { await onAccept(); } catch (error) { onNotice(error.message); } };
  const toggleMic = () => {
    localStream?.getAudioTracks().forEach(t => { t.enabled = muted; });
    setMuted(!muted);
  };
  const toggleCamera = () => {
    localStream?.getVideoTracks().forEach(t => { t.enabled = cameraOff; });
    setCameraOff(!cameraOff);
  };
  return (
    <div role="dialog" aria-modal="true" aria-label="Group voice or video call" className="fixed inset-0 z-[140] bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
      <section className="w-full max-w-2xl rounded-3xl bg-slate-950 text-white border border-white/15 shadow-2xl p-5 sm:p-7">
        <div className="flex gap-3 items-center mb-5">
          <span className="p-3 bg-violet-600 rounded-2xl"><Users size={22}/></span>
          <div><h2 className="text-lg font-semibold">{call.groupName || 'Group call'}</h2>
            <p className="text-sm text-slate-400">{incoming ? 'Incoming group call' : `${call.type === 'video' ? 'Video' : 'Voice'} call · ${Object.keys(remotes).length + 1} joined · Up to 4 people`}</p></div>
        </div>
        {incoming ? (
          <div className="py-8 flex items-center justify-center gap-5">
            <button className="bg-emerald-600 px-6 py-3 rounded-full flex items-center gap-2" onClick={join}><Phone size={19}/> Join call</button>
            <button className="bg-red-600 px-6 py-3 rounded-full flex items-center gap-2" onClick={onLeave}><PhoneOff size={19}/> Decline</button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[55vh] overflow-auto">
              <StreamTile stream={localStream} name="You" muted video={call.type === 'video'} />
              {Object.entries(remotes).map(([phone, stream]) => (
                <StreamTile key={phone} stream={stream} name={users.find(u => u.phone === phone)?.name || 'Participant'} video={call.type === 'video'} />
              ))}
              {!Object.keys(remotes).length && <div className="rounded-2xl bg-slate-900/70 min-h-36 flex items-center justify-center text-slate-400 text-sm p-5">Waiting for group members to join…</div>}
            </div>
            <div className="flex justify-center items-center gap-4 pt-5">
              <button className="p-3 rounded-full bg-white/15" aria-label="Toggle microphone" onClick={toggleMic}>{muted ? <MicOff/> : <Mic/>}</button>
              {call.type === 'video' && <button className="p-3 rounded-full bg-white/15" aria-label="Toggle camera" onClick={toggleCamera}>{cameraOff ? <VideoOff/> : <Video/>}</button>}
              <button className="px-5 py-3 rounded-full bg-red-600 flex gap-2 items-center" onClick={onLeave}><PhoneOff size={18}/> Leave call</button>
            </div>
          </>
        )}
        <p className="text-xs text-slate-500 mt-4 text-center">Keep PulseChat open during the call. Calls may need TURN on restricted networks.</p>
      </section>
    </div>
  );
}
