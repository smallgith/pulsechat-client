import { useEffect, useRef, useState } from 'react';
import {
  Mic, MicOff, Video as VideoIcon, VideoOff, PhoneOff,
  Phone, Volume2, VolumeX, Maximize2, Minimize2, Loader2, Camera,
} from 'lucide-react';
import Avatar from './Avatar';

/* ==================== RINGTONE HOOK ==================== */
function useRingtone(active) {
  useEffect(() => {
    if (!active) return;

    let audio = null;
    let intervalId = null;
    let synthCtx = null;

    const start = async () => {
      // Try mp3 file first
      try {
        audio = new Audio('/voice-call-rington.mp3');
        audio.loop = true;
        audio.volume = 1;
        await audio.play();
        console.log('[ringtone] playing mp3');
        return;
      } catch (e) {
        console.warn('[ringtone] mp3 failed, using synth', e.message);
      }

      // Fallback: synthesized ringtone
      try {
        synthCtx = new (window.AudioContext || window.webkitAudioContext)();
        const beep = () => {
          if (!synthCtx || synthCtx.state === 'closed') return;
          const now = synthCtx.currentTime;
          [0, 0.4].forEach((offset, i) => {
            const osc = synthCtx.createOscillator();
            const gain = synthCtx.createGain();
            osc.type = 'sine';
            osc.frequency.value = i === 0 ? 850 : 1050;
            gain.gain.setValueAtTime(0, now + offset);
            gain.gain.linearRampToValueAtTime(0.3, now + offset + 0.02);
            gain.gain.linearRampToValueAtTime(0, now + offset + 0.3);
            osc.connect(gain);
            gain.connect(synthCtx.destination);
            osc.start(now + offset);
            osc.stop(now + offset + 0.35);
          });
        };
        beep();
        intervalId = setInterval(beep, 2000);
      } catch {}
    };

    start();

    return () => {
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
        audio.src = '';
        audio = null;
      }
      if (intervalId) clearInterval(intervalId);
      if (synthCtx) {
        try { synthCtx.close(); } catch {}
      }
    };
  }, [active]);
}

export default function CallModal({
  call, localStream, remoteStream,
  onEnd, onAccept, onReject, isIncoming,
}) {
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);          // camera on by default
  const [speakerOn, setSpeakerOn] = useState(false); // 🔥 DEFAULT OFF
  const [minimized, setMinimized] = useState(false);
  const [remoteReady, setRemoteReady] = useState(false);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);

  /* ========== RINGTONE — incoming call ========== */
  useRingtone(isIncoming);

  /* ========== ATTACH LOCAL STREAM ========== */
  useEffect(() => {
    const el = localVideoRef.current;
    if (!el || !localStream) return;
    if (el.srcObject === localStream) return;
    el.srcObject = localStream;
    el.play().catch((e) => console.warn('local play:', e));
  }, [localStream, camOn, minimized]);

  /* ========== ATTACH REMOTE STREAM ========== */
  useEffect(() => {
    if (!remoteStream) {
      setRemoteReady(false);
      return;
    }

    const attach = async () => {
      const v = remoteVideoRef.current;
      const a = remoteAudioRef.current;

      if (v && v.srcObject !== remoteStream) {
        v.srcObject = remoteStream;
        try {
          await v.play();
          setRemoteReady(true);
          console.log('[remote video] playing ✓');
        } catch (e) {
          console.warn('[remote video] play fail:', e);
          // retry after user gesture
          setTimeout(() => {
            v.play().then(() => setRemoteReady(true)).catch(() => {});
          }, 300);
        }
      }

      if (a && a.srcObject !== remoteStream) {
        a.srcObject = remoteStream;
        try {
          await a.play();
        } catch (e) {
          console.warn('[remote audio] play fail:', e);
          setTimeout(() => a.play().catch(() => {}), 300);
        }
      }
    };

    attach();

    const onAddTrack = () => attach();
    remoteStream.addEventListener('addtrack', onAddTrack);
    return () => remoteStream.removeEventListener('addtrack', onAddTrack);
  }, [remoteStream, minimized]);

  /* ========== TOGGLES ========== */
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
    setSpeakerOn((prev) => {
      const next = !prev;
      // Speaker ON = max volume; OFF = medium (earpiece-like)
      const vol = next ? 1 : 0.5;
      if (remoteAudioRef.current) remoteAudioRef.current.volume = vol;
      if (remoteVideoRef.current) remoteVideoRef.current.volume = vol;
      return next;
    });
  };

  /* ========== SET INITIAL VOLUME (speaker OFF = 0.5) ========== */
  useEffect(() => {
    if (remoteAudioRef.current) remoteAudioRef.current.volume = 0.5;
    if (remoteVideoRef.current) remoteVideoRef.current.volume = 0.5;
  }, [remoteStream]);

  if (!call) return null;

  const isVideo = call.type === 'video';
  const isRinging = call.state === 'calling';
  const isConnected = call.state === 'connected';

  /* ==================== INCOMING SCREEN ==================== */
  if (isIncoming) {
    return (
      <div className="fixed inset-0 z-[130] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-pop-in safe-top safe-bottom">
        <div className="w-full max-w-sm glass-solid rounded-3xl shadow-2xl border border-white/10 p-6 sm:p-8 text-center">
          <div className="flex justify-center mb-5">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-brand-500/30 animate-ping" />
              <Avatar name={call.peerName} size={96} ring />
            </div>
          </div>

          <h3 className="text-xl font-semibold mb-1 truncate">{call.peerName}</h3>
          <p className="text-sm text-slate-400 mb-8">
            Incoming {isVideo ? 'video' : 'voice'} call…
          </p>

          <div className="flex justify-center gap-6">
            <button
              onClick={onReject}
              className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-lg shadow-red-500/30 transition active:scale-95"
            >
              <PhoneOff className="w-7 h-7 text-white" />
            </button>
            <button
              onClick={onAccept}
              className="w-16 h-16 rounded-full bg-brand-500 hover:bg-brand-600 flex items-center justify-center shadow-lg shadow-brand-500/30 transition active:scale-95 animate-pulse"
            >
              <Phone className="w-7 h-7 text-white" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ==================== MINIMIZED ==================== */
  if (minimized) {
    return (
      <div className="fixed top-4 right-4 z-[130] glass-solid rounded-2xl shadow-2xl border border-white/10 p-3 flex items-center gap-3 animate-pop-in max-w-[calc(100vw-2rem)]">
        <Avatar name={call.peerName} size={40} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold truncate">{call.peerName}</p>
          <p className="text-[11px] text-brand-400">
            {isConnected ? 'Connected' : 'Ringing…'}
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

  /* ==================== FULL SCREEN ==================== */
  return (
    <div className="fixed inset-0 z-[130] bg-gradient-to-br from-ink-900 via-ink-800 to-black flex flex-col animate-pop-in safe-top safe-bottom">
      {/* Hidden audio for voice-only calls */}
      <audio ref={remoteAudioRef} autoPlay playsInline />

      {/* TOP BAR */}
      <div className="flex items-center gap-3 p-3 sm:p-4 shrink-0">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-base sm:text-lg truncate">
            {call.peerName}
          </p>
          <p className="text-[11px] sm:text-xs text-slate-400 truncate">
            {isConnected ? 'Connected' : 'Ringing…'}
          </p>
        </div>
        <button
          onClick={() => setMinimized(true)}
          className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 transition shrink-0"
        >
          <Minimize2 className="w-5 h-5" />
        </button>
      </div>

      {/* VIDEO AREA */}
      <div className="flex-1 relative mx-2 sm:mx-4 rounded-2xl sm:rounded-3xl overflow-hidden bg-black min-h-0">
        {/* Remote video — ALWAYS RENDERED, hidden if audio call */}
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
          style={{
            display: isVideo && remoteReady ? 'block' : 'none',
          }}
        />

        {/* Placeholder overlay */}
        {(!isVideo || !remoteReady) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-4">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-brand-500/20 animate-ping" />
              <Avatar name={call.peerName} size={120} ring />
            </div>
            <p className="text-base sm:text-lg font-medium text-center truncate max-w-full px-4">
              {call.peerName}
            </p>
            <p className="text-xs sm:text-sm text-slate-400 text-center flex items-center gap-2">
              {isRinging ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Calling…
                </>
              ) : isVideo && !remoteReady ? (
                'Connecting video…'
              ) : (
                '🔊 On call'
              )}
            </p>
          </div>
        )}

        {/* Local PiP — ALWAYS RENDERED */}
        {isVideo && (
          <div
            className="absolute top-2 right-2 sm:top-4 sm:right-4 w-24 h-32 sm:w-32 sm:h-44 md:w-44 md:h-60 rounded-xl sm:rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl bg-black z-10"
            style={{ display: camOn && localStream ? 'block' : 'none' }}
          >
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
              style={{ transform: 'scaleX(-1)' }}
            />
          </div>
        )}

        {/* Camera off indicator */}
        {isVideo && !camOn && (
          <div className="absolute top-2 right-2 sm:top-4 sm:right-4 w-24 h-32 sm:w-32 sm:h-44 md:w-44 md:h-60 rounded-xl sm:rounded-2xl bg-ink-900 border-2 border-white/10 flex flex-col items-center justify-center gap-2 z-10">
            <Camera className="w-6 h-6 text-slate-500" />
            <span className="text-[10px] text-slate-500">Camera off</span>
          </div>
        )}
      </div>

      {/* CONTROLS */}
      <div className="flex items-center justify-center gap-2 sm:gap-4 p-3 sm:p-6 shrink-0">
        <button
          onClick={toggleMic}
          className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center transition active:scale-95 ${
            micOn
              ? 'bg-white/10 hover:bg-white/20'
              : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
          }`}
        >
          {micOn ? (
            <Mic className="w-5 h-5 sm:w-6 sm:h-6" />
          ) : (
            <MicOff className="w-5 h-5 sm:w-6 sm:h-6" />
          )}
        </button>

        {isVideo && (
          <button
            onClick={toggleCam}
            className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center transition active:scale-95 ${
              camOn
                ? 'bg-white/10 hover:bg-white/20'
                : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
            }`}
          >
            {camOn ? (
              <VideoIcon className="w-5 h-5 sm:w-6 sm:h-6" />
            ) : (
              <VideoOff className="w-5 h-5 sm:w-6 sm:h-6" />
            )}
          </button>
        )}

        <button
          onClick={onEnd}
          className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-2xl shadow-red-500/40 transition active:scale-95"
        >
          <PhoneOff className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
        </button>

        <button
          onClick={toggleSpeaker}
          className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center transition active:scale-95 ${
            speakerOn
              ? 'bg-brand-500/30 text-brand-400'
              : 'bg-white/10 hover:bg-white/20'
          }`}
          title={speakerOn ? 'Speaker ON' : 'Speaker OFF'}
        >
          {speakerOn ? (
            <Volume2 className="w-5 h-5 sm:w-6 sm:h-6" />
          ) : (
            <VolumeX className="w-5 h-5 sm:w-6 sm:h-6" />
          )}
        </button>
      </div>
    </div>
  );
}