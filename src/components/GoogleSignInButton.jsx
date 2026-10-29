import { useEffect, useRef, useState } from 'react';

let loading;
function loadGoogleIdentity() {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => { loading = undefined; reject(new Error('Could not load Google Sign-In. Check your connection.')); };
    document.head.appendChild(script);
  });
  return loading;
}

export default function GoogleSignInButton({ clientId, onCredential, onError, disabled }) {
  const ref = useRef(null);
  const callbacks = useRef({ onCredential, onError });
  const [loadError, setLoadError] = useState('');
  callbacks.current = { onCredential, onError };

  useEffect(() => {
    if (!clientId) return;
    let active = true;
    loadGoogleIdentity().then(() => {
      if (!active || !ref.current) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: ({ credential }) => {
          if (credential) callbacks.current.onCredential?.(credential);
          else callbacks.current.onError?.(new Error('Google Sign-In was cancelled.'));
        },
        auto_select: false,
      });
      ref.current.replaceChildren();
      window.google.accounts.id.renderButton(ref.current, {
        theme: 'outline', size: 'large', text: 'continue_with', shape: 'pill',
        width: Math.min(340, Math.max(220, ref.current.offsetWidth || 320)),
      });
    }).catch((error) => { if (active) { setLoadError(error.message); callbacks.current.onError?.(error); } });
    return () => { active = false; };
  }, [clientId]);

  return <div className={`flex flex-col items-center gap-2 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
    <div ref={ref} className="w-full flex justify-center min-h-[42px]" />
    {loadError && <p role="alert" className="error-banner text-xs">{loadError}</p>}
  </div>;
}
