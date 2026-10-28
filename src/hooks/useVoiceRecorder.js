import { useRef, useState, useCallback, useEffect } from 'react';

export function useVoiceRecorder() {
  const [recording, setRecording] = useState(false), [seconds, setSeconds] = useState(0);
  const mediaRec = useRef(null), chunks = useRef([]), timer = useRef(), stream = useRef(), started = useRef(0), mounted = useRef(true);
  const cleanup = () => { clearInterval(timer.current); stream.current?.getTracks().forEach((t) => t.stop()); stream.current = null; };
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; if (mediaRec.current?.state === 'recording') { mediaRec.current.onstop = null; mediaRec.current.stop(); } cleanup(); }; }, []);
  const start = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) return false;
      const local = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      if (!mounted.current) { local.getTracks().forEach((t) => t.stop()); return false; }
      stream.current = local; chunks.current = [];
      const mimeType = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus'].find((m) => MediaRecorder.isTypeSupported(m));
      const mr = new MediaRecorder(local, mimeType ? { mimeType } : {}); mediaRec.current = mr;
      mr.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data); };
      mr.start(); started.current = Date.now(); setRecording(true); setSeconds(0);
      timer.current = setInterval(() => setSeconds(Math.floor((Date.now() - started.current) / 1000)), 1000);
      return true;
    } catch { cleanup(); return false; }
  }, []);
  const stop = useCallback(() => new Promise((resolve) => {
    const mr = mediaRec.current;
    if (!mr || mr.state !== 'recording') return resolve(null);
    mr.onstop = () => {
      const blob = new Blob(chunks.current, { type: mr.mimeType });
      const duration = Math.max(1, Math.round((Date.now() - started.current) / 1000));
      cleanup(); mediaRec.current = null;
      if (mounted.current) { setRecording(false); setSeconds(0); }
      resolve({ blob, duration, url: URL.createObjectURL(blob) });
    };
    mr.stop();
  }), []);
  const cancel = useCallback(() => {
    const mr = mediaRec.current;
    if (mr?.state === 'recording') { mr.onstop = null; mr.stop(); }
    cleanup(); chunks.current = []; mediaRec.current = null; setRecording(false); setSeconds(0);
  }, []);
  return { recording, seconds, start, stop, cancel };
}
