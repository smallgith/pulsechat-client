import { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Phone, Headphones, Maximize2, Minimize2, Volume2 } from 'lucide-react';
import Avatar from './Avatar';

function useRingtone(active) {
  useEffect(() => {
    if (!active) return;
    const audio = new Audio('/voice-call-rington.mp3'); audio.loop = true; audio.volume = 0.65;
    audio.play().catch(() => {});
    return () => { audio.pause(); audio.src = ''; };
  }, [active]);
}

export default function CallModal({ call, localStream, remoteStream, onEnd, onAccept, onReject, isIncoming }) {
  const [micOn, setMicOn] = useState(true), [camOn, setCamOn] = useState(true), [minimized, setMinimized] = useState(false);
  const [outputs, setOutputs] = useState([]), [output, setOutput] = useState(''), [outputOpen, setOutputOpen] = useState(false);
  const [outputError, setOutputError] = useState(''), [playBlocked, setPlayBlocked] = useState(false), [elapsed, setElapsed] = useState(0);
  const audioRef = useRef(null), remoteVideoRef = useRef(null), localVideoRef = useRef(null), didSetDefault = useRef(false);
  const canRoute = typeof HTMLMediaElement !== 'undefined' && typeof HTMLMediaElement.prototype.setSinkId === 'function';
  useRingtone(isIncoming);
  // Exactly one audio sink stays mounted, including while the call is minimized.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.srcObject = remoteStream || null;
    if (remoteStream) audio.play().then(() => setPlayBlocked(false)).catch(() => setPlayBlocked(true));
  }, [remoteStream]);
  useEffect(() => {
    const video = remoteVideoRef.current;
    if (video) { video.srcObject = remoteStream || null; if (remoteStream) video.play().catch(() => {}); }
    const local = localVideoRef.current;
    if (local) { local.srcObject = localStream || null; if (localStream) local.play().catch(() => {}); }
  }, [remoteStream, localStream, minimized, isIncoming]);
  useEffect(() => {
    if (!call.connectedAt) return;
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - call.connectedAt) / 1000)));
    tick(); const timer = setInterval(tick, 1000); return () => clearInterval(timer);
  }, [call.connectedAt]);
  const route = useCallback(async (id) => {
    if (!audioRef.current?.setSinkId) return;
    try { await audioRef.current.setSinkId(id); setOutput(id); setOutputError(''); }
    catch { setOutputError('This output could not be selected. Check browser permissions or device audio settings.'); }
  }, []);
  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      try {
        const list = (await navigator.mediaDevices?.enumerateDevices() || []).filter((d) => d.kind === 'audiooutput');
        if (!alive) return;
        setOutputs(list);
        if (!didSetDefault.current && localStream && canRoute) {
          didSetDefault.current = true;
          // Prefer an actual communications/headset device. Never emulate routing with volume.
          const preferred = list.find((d) => d.deviceId === 'communications') || list.find((d) => /earpiece|headset|headphone|earphone|airpods|bluetooth/i.test(d.label));
          await route(preferred?.deviceId || '');
        }
      } catch { /* System routing remains available. */ }
    };
    refresh(); navigator.mediaDevices?.addEventListener('devicechange', refresh);
    return () => { alive = false; navigator.mediaDevices?.removeEventListener('devicechange', refresh); };
  }, [localStream, canRoute, route]);
  const chooseOutput = async () => {
    setOutputOpen(!outputOpen);
    if (navigator.mediaDevices?.selectAudioOutput && canRoute) {
      try { const device = await navigator.mediaDevices.selectAudioOutput(); await route(device.deviceId); setOutputs((p) => [...p.filter((d) => d.deviceId !== device.deviceId), device]); }
      catch (e) { if (e.name !== 'NotAllowedError') setOutputError('Use your device audio controls to choose the output.'); }
    }
  };
  const duration = `${Math.floor(elapsed / 60).toString().padStart(2, '0')}:${(elapsed % 60).toString().padStart(2, '0')}`;
  const label = isIncoming ? `Incoming ${call.type === 'video' ? 'video' : 'voice'} call` : call.state === 'connected' ? duration : call.state === 'calling' ? 'Ringing…' : call.state === 'preparing' ? 'Starting microphone…' : 'Connecting…';
  const toggleMic = () => { localStream?.getAudioTracks().forEach((t) => { t.enabled = !micOn; }); setMicOn(!micOn); };
  const toggleCam = () => { localStream?.getVideoTracks().forEach((t) => { t.enabled = !camOn; }); setCamOn(!camOn); };
  return <>
    <audio ref={audioRef} autoPlay playsInline />
    {minimized ? <div className="fixed top-4 right-4 z-[130] glass-solid rounded-2xl shadow-2xl p-3 flex items-center gap-3 max-w-[calc(100vw-2rem)]"><Avatar name={call.peerName} size={40} /><div className="min-w-0"><p className="text-sm font-semibold truncate">{call.peerName}</p><p className="text-xs text-brand-400">{label}</p></div><button className="icon-btn" aria-label="Restore call" onClick={() => setMinimized(false)}><Maximize2 size={18} /></button><button className="icon-btn text-red-400" aria-label="End call" onClick={onEnd}><PhoneOff size={20} /></button></div> : <div role="dialog" aria-modal="true" aria-label={`${call.type === 'video' ? 'Video' : 'Voice'} call`} className="fixed inset-0 z-[130] bg-gradient-to-br from-ink-900 via-ink-800 to-black flex flex-col safe-top safe-bottom">
      <header className="flex items-center gap-3 p-4"><div className="flex-1 min-w-0"><h3 className="font-semibold truncate">{call.peerName}</h3><p className="text-xs text-brand-400">{label}</p></div>{!isIncoming && <button className="icon-btn" aria-label="Minimize call" onClick={() => setMinimized(true)}><Minimize2 size={20} /></button>}</header>
      <div className="flex-1 relative mx-3 rounded-3xl overflow-hidden bg-black/40 min-h-0">
        {call.type === 'video' && !isIncoming && <video ref={remoteVideoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-contain" />}
        {(!remoteStream?.getVideoTracks().length || isIncoming) && <div className="absolute inset-0 flex flex-col items-center justify-center gap-5"><Avatar name={call.peerName} size={120} ring /><p className="text-xl font-medium">{call.peerName}</p><p className="text-sm text-slate-400">{label}</p></div>}
        {call.type === 'video' && !isIncoming && <div className="absolute top-3 right-3 w-28 h-40 sm:w-40 sm:h-52 rounded-2xl overflow-hidden border border-white/20 bg-ink-900"><video ref={localVideoRef} autoPlay muted playsInline className={`w-full h-full object-cover -scale-x-100 ${camOn ? '' : 'invisible'}`} />{!camOn && <span className="absolute inset-0 flex items-center justify-center text-xs text-slate-400">Camera off</span>}</div>}
      </div>
      {playBlocked && <button className="btn-primary mx-auto mt-3" onClick={() => audioRef.current?.play().then(() => setPlayBlocked(false)).catch(() => {})}>Tap to hear call audio</button>}
      {!isIncoming && outputOpen && <div className="mx-auto mt-3 p-3 rounded-xl glass-solid w-[min(92vw,420px)] space-y-2">{canRoute && outputs.length ? <label className="field-label">Audio output<select className="field" value={output} onChange={(e) => route(e.target.value)}><option value="">System default</option>{outputs.filter((d) => d.deviceId !== 'default').map((d, i) => <option key={d.deviceId} value={d.deviceId}>{d.label || `Output ${i + 1}`}</option>)}</select></label> : <p className="text-xs text-slate-300">This browser uses your device's audio route. Choose earpiece, Bluetooth or speaker using your device audio controls.</p>}{outputError && <p className="text-xs text-amber-300">{outputError}</p>}</div>}
      <div className="flex items-center justify-center gap-3 sm:gap-5 p-5 shrink-0">{isIncoming ? <><button aria-label="Decline call" className="call-control bg-red-500" onClick={onReject}><PhoneOff /></button><button aria-label="Accept call" className="call-control bg-brand-500" onClick={onAccept}><Phone /></button></> : <><button aria-label={micOn ? 'Mute microphone' : 'Unmute microphone'} aria-pressed={!micOn} disabled={!localStream} className={`call-control ${micOn ? 'bg-white/10' : 'bg-red-500/30 text-red-300'}`} onClick={toggleMic}>{micOn ? <Mic /> : <MicOff />}</button>{call.type === 'video' && <button aria-label={camOn ? 'Turn camera off' : 'Turn camera on'} aria-pressed={camOn} disabled={!localStream} className="call-control bg-white/10" onClick={toggleCam}>{camOn ? <Video /> : <VideoOff />}</button>}<button aria-label="End call" className="call-control bg-red-500 hover:bg-red-600" onClick={onEnd}><PhoneOff /></button><button aria-label="Audio output" title="Audio output" className={`call-control ${outputOpen ? 'bg-brand-500/30' : 'bg-white/10'}`} onClick={chooseOutput}>{outputs.find((d) => d.deviceId === output)?.label?.match(/speaker/i) ? <Volume2 /> : <Headphones />}</button></>}</div>
    </div>}
  </>;
}
