import { useEffect, useRef, useState } from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';

const BAR_HEIGHTS = Array.from({ length: 38 }, (_, i) =>
  Math.round(8 + 20 * Math.abs(Math.sin((i + 2) * 1.14) * Math.cos((i + 1) * .41))));
const timeText = (time) => `${Math.floor((Number(time) || 0) / 60)}:${String(Math.floor((Number(time) || 0) % 60)).padStart(2, '0')}`;

// An accessible voice note UI. The bars are a visual timeline, not a claim of transcription.
export default function VoiceNotePlayer({ src, duration = 0, mine = false }) {
  const audio = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [total, setTotal] = useState(Number(duration) || 0);
  const [speed, setSpeed] = useState(1);
  const [failed, setFailed] = useState(false);
  const progress = total ? Math.min(100, elapsed / total * 100) : 0;

  useEffect(() => {
    setElapsed(0); setPlaying(false); setFailed(false); setTotal(Number(duration) || 0);
    return () => { audio.current?.pause(); };
  }, [src, duration]);
  const toggle = async () => {
    if (!audio.current) return;
    if (playing) { audio.current.pause(); return; }
    try { await audio.current.play(); setFailed(false); }
    catch { setFailed(true); }
  };
  const seek = (value) => {
    if (!audio.current || !Number.isFinite(total) || total <= 0) return;
    audio.current.currentTime = (Number(value) / 100) * total;
    setElapsed(audio.current.currentTime);
  };
  const changeSpeed = () => {
    const next = speed === 1 ? 1.5 : speed === 1.5 ? 2 : 1;
    setSpeed(next);
    if (audio.current) audio.current.playbackRate = next;
  };
  return (
    <div className={`voice-note ${mine ? 'voice-note-mine' : ''}`}>
      <audio ref={audio} preload="metadata" src={src}
        onLoadedMetadata={(e) => { const t = e.currentTarget.duration; if (Number.isFinite(t)) setTotal(t); }}
        onTimeUpdate={(e) => setElapsed(e.currentTarget.currentTime)}
        onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setElapsed(0); }}
        onError={() => setFailed(true)} />
      <button type="button" className="voice-play" onClick={toggle}
        aria-label={playing ? 'Pause voice note' : 'Play voice note'}>
        {playing ? <Pause size={19} fill="currentColor" /> : <Play size={19} fill="currentColor" />}
      </button>
      <div className="voice-timeline">
        <div className="voice-bars" aria-hidden="true">
          {BAR_HEIGHTS.map((h, index) => <span key={index} style={{ height: h, opacity: index / BAR_HEIGHTS.length * 100 <= progress ? 1 : .36 }} />)}
        </div>
        <input type="range" className="voice-range" aria-label="Seek voice message" min="0" max="100" step=".5"
          value={progress} onChange={(e) => seek(e.target.value)} />
        <div className="voice-foot"><span>{timeText(elapsed)} / {timeText(total)}</span><span>Voice note</span></div>
      </div>
      <button type="button" className="voice-speed" onClick={changeSpeed} aria-label={`Playback speed ${speed}x. Change speed`}>{speed}×</button>
      {failed && <button type="button" className="voice-error" onClick={() => { audio.current?.load(); setFailed(false); }} aria-label="Retry voice note"><RotateCcw size={14}/></button>}
    </div>
  );
}
