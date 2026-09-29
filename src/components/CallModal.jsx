import { useEffect, useRef, useState } from 'react';
import {
  Mic, MicOff, Video as VideoIcon, VideoOff, PhoneOff,
  Phone, Volume2, VolumeX, Maximize2, Minimize2, Loader2,
} from 'lucide-react';
import Avatar from './Avatar';

export default function CallModal({
  call,        // { type, peer, peerName, state: 'calling'|'connected' }
  localStream,
  remoteStream,
  onEnd,
  onAccept,    // only for incoming
  onReject,
  isIncoming,
}) {
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(call?.type === 'video');
  const [speakerOn, setSpeakerOn] = useState(true);
  const [minimized, setMinimized] = useState(false);
  const [seconds, setSeconds] = useState(0);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const audioRef = useRef(null);

  /* ---------- attach streams ---------- */
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
    if (audioRef.current && remoteStream && call?.type === 'audio') {
      audioRef.current.srcObject = remoteStream;
    }
  }, [remoteStream, call?.type]);

  /* ---------- call timer ---------- */
  useEffect(() => {
    if (call?.state !== 'connected') return;
    setSeconds(0);
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [call?.state]);

  /* ---------- toggle mic/cam ---------- */
  const toggleMic = () => {
    setMicOn((v) => {
      localStream?.getAudioTracks().forEach((t) => (t.enabled = !v));
      return !v;
    });
  };
  const toggleCam = () => {
    setCamOn((v) => {
      localStream?.getVideoTracks().forEach((t) => (t.enabled = !v));
      return !v;
    });
  };
  const toggleSpeaker = () => {
    setSpeakerOn((v) => {
      if (audioRef.current) audioRef.current.muted = v;
      if (remoteVideoRef.current) remoteVideoRef.current.muted = v;
      return !v;
    });
  };

  const fmt = (s) =>
    `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  if (!call) return null;

  const isVideo = call.type === 'video';
  const isRinging = call.state === 'calling';
  const isConnected = call.state === 'connected';

  /* ============ INCOMING ============ */
  if (isIncoming) {
    return (
      <div className="fixed inset-0 z-[130] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-pop-in">
        <div className="w-full max-w-sm glass rounded-3xl shadow-2xl border border-white/10 p-8 text-center">
          <div className="flex justify-center mb-5">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-brand-500/30 animate-ping" />
              <Avatar name={call.peerName} size={96} ring />
            </div>
          </div>

          <h3 className="text-xl font-semibold mb-1">{call.peerName}</h3>
          <p className="text-sm text-slate-400 mb-8">
            Incoming {isVideo ? 'video' : 'voice'} call…
          </p>

          <div className="flex justify-center gap-6">
            <button
              onClick={onReject}
              className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-lg shadow-red-500/30 transition active:scale-95"
            >
              <PhoneOff className="w-6 h-6 text-white" />
            </button>
            <button
              onClick={onAccept}
              className="w-14 h-14 rounded-full bg-brand-500 hover:bg-brand-600 flex items-center justify-center shadow-lg shadow-brand-500/30 transition active:scale-95 animate-pulse"
            >
              <Phone className="w-6 h-6 text-white" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ============ MINIMIZED ============ */
  if (minimized) {
    return (
      <div className="fixed top-4 right-4 z-[130] glass rounded-2xl shadow-2xl border border-white/10 p-3 flex items-center gap-3 animate-pop-in">
        <Avatar name={call.peerName} size={40} />
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">{call.peerName}</p>
          <p className="text-[11px] text-brand-400">
            {isConnected ? fmt(seconds) : 'Ringing…'}
          </p>
        </div>
        <button
          onClick={() => setMinimized(false)}
          className="p-2 rounded-lg bg-white/5 hover:bg-white/10"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
        <button
          onClick={onEnd}
          className="p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30"
        >
          <PhoneOff className="w-4 h-4" />
        </button>
      </div>
    );
  }

  /* ============ FULL SCREEN ============ */
  return (
    <div className="fixed inset-0 z-[130] bg-gradient-to-br from-ink-900 via-ink-800 to-black flex flex-col animate-pop-in">
      <audio ref={audioRef} autoPlay playsInline />

      {/* top bar */}
      <div className="flex items-center gap-3 p-4">
        <div className="flex-1">
          <p className="font-semibold text-lg">{call.peerName}</p>
          <p className="text-xs text-slate-400">
            {isConnected ? `Connected • ${fmt(seconds)}` : 'Ringing…'}
          </p>
        </div>
        <button
          onClick={() => setMinimized(true)}
          className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 transition"
          title="Minimize"
        >
          <Minimize2 className="w-5 h-5" />
        </button>
      </div>

      {/* video area */}
      <div className="flex-1 relative mx-4 rounded-3xl overflow-hidden bg-black/60 border border-white/10">
        {/* remote (main) */}
        {isVideo && remoteStream ? (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-brand-500/20 animate-ping" />
              <Avatar name={call.peerName} size={140} ring />
            </div>
            <p className="text-lg font-medium">{call.peerName}</p>
            <p className="text-sm text-slate-400">
              {isRinging ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Calling…
                </span>
              ) : isVideo ? (
                'Waiting for video…'
              ) : (
                '🔊 On call'
              )}
            </p>
          </div>
        )}

        {/* local PiP */}
        {isVideo && localStream && (
          <div className="absolute bottom-4 right-4 w-32 h-44 sm:w-44 sm:h-60 rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl bg-black">
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover mirror"
              style={{ transform: 'scaleX(-1)' }}
            />
          </div>
        )}
      </div>

      {/* controls */}
      <div className="flex items-center justify-center gap-4 p-6">
        <button
          onClick={toggleMic}
          className={`w-14 h-14 rounded-full flex items-center justify-center transition active:scale-95 ${
            micOn ? 'bg-white/10 hover:bg-white/20' : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
          }`}
          title={micOn ? 'Mute' : 'Unmute'}
        >
          {micOn ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
        </button>

        {isVideo && (
          <button
            onClick={toggleCam}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition active:scale-95 ${
              camOn ? 'bg-white/10 hover:bg-white/20' : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
            }`}
          >
            {camOn ? <VideoIcon className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
          </button>
        )}

        <button
          onClick={onEnd}
          className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-2xl shadow-red-500/40 transition active:scale-95"
          title="End call"
        >
          <PhoneOff className="w-7 h-7 text-white" />
        </button>

        <button
          onClick={toggleSpeaker}
          className={`w-14 h-14 rounded-full flex items-center justify-center transition active:scale-95 ${
            speakerOn ? 'bg-white/10 hover:bg-white/20' : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
          }`}
          title={speakerOn ? 'Mute speaker' : 'Unmute'}
        >
          {speakerOn ? <Volume2 className="w-6 h-6" /> : <VolumeX className="w-6 h-6" />}
        </button>
      </div>
    </div>
  );
}