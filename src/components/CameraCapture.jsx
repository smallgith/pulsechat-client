import { useEffect, useRef, useState } from 'react';
import { Camera, RefreshCw } from 'lucide-react';
import Modal from './Modal';

export default function CameraCapture({ onCapture, onClose }) {
  const video = useRef(),
    stream = useRef();
  const [error, setError] = useState(''),
    [ready, setReady] = useState(false),
    [facing, setFacing] = useState('user');
  useEffect(() => {
    let active = true;
    setReady(false);
    setError('');
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia)
          throw new Error('Camera access requires HTTPS or localhost.');
        const media = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing, width: { ideal: 1600 } },
          audio: false,
        });
        if (!active) {
          media.getTracks().forEach((t) => t.stop());
          return;
        }
        stream.current = media;
        video.current.srcObject = media;
        await video.current.play();
        setReady(true);
      } catch (e) {
        if (active) setError(e.message || 'Allow camera access in browser settings.');
      }
    })();
    return () => {
      active = false;
      stream.current?.getTracks().forEach((t) => t.stop());
    };
  }, [facing]);
  const capture = () => {
    const canvas = document.createElement('canvas');
    canvas.width = video.current.videoWidth;
    canvas.height = video.current.videoHeight;
    canvas.getContext('2d').drawImage(video.current, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (blob) {
          onCapture(new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' }));
          onClose();
        }
      },
      'image/jpeg',
      0.9
    );
  };
  return (
    <Modal title="Capture a moment" onClose={onClose}>
      <video
        ref={video}
        autoPlay
        muted
        playsInline
        className="w-full rounded-2xl bg-black min-h-48"
      />
      {error && (
        <p role="alert" className="error-banner">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button
          className="btn-secondary"
          aria-label="Switch camera"
          onClick={() => setFacing(facing === 'user' ? 'environment' : 'user')}
        >
          <RefreshCw size={18} />
        </button>
        <button className="btn-primary flex-1" onClick={capture} disabled={!ready}>
          <Camera size={17} />
          Take photo
        </button>
      </div>
    </Modal>
  );
}
