import { useEffect, useRef, useState } from 'react';
import { MessageCircle, Loader2 } from 'lucide-react';
import GoogleSignInButton from './GoogleSignInButton';
import { SOCKET_URL } from '../lib/socket';

export default function Login({ onJoin, error }) {
  const [googleClientId, setGoogleClientId] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState('');
  const [retry, setRetry] = useState(0);
  const [link, setLink] = useState(null);
  const onJoinRef = useRef(onJoin);
  onJoinRef.current = onJoin;
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLocalError('');
    fetch(`${SOCKET_URL}/api/config`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('Login server is unavailable. Please retry.');
        const config = await response.json();
        if (!config.googleClientId)
          throw new Error('Google Sign-In needs to be configured by the site owner.');
        setGoogleClientId(config.googleClientId);
      })
      .catch((error) => {
        if (error.name !== 'AbortError') setLocalError(error.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [retry]);
  const join = (data) =>
    onJoinRef.current({ ...data.user, token: data.token, expiresAt: data.expiresAt });
  const signInGoogle = async (credential) => {
    setBusy(true);
    setLocalError('');
    try {
      const response = await fetch(`${SOCKET_URL}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || 'Google Sign-In failed.');
      join(data);
    } catch (error) {
      setLocalError(error.message);
    } finally {
      setBusy(false);
    }
  };
  const startLink = async () => {
    setBusy(true);
    setLocalError('');
    try {
      const response = await fetch(`${SOCKET_URL}/api/device-link/start`, { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not link this device.');
      setLink(data);
    } catch (error) {
      setLocalError(error.message);
    } finally {
      setBusy(false);
    }
  };
  const cancelLink = () => {
    if (link)
      fetch(`${SOCKET_URL}/api/device-link/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: link.requestId, secret: link.secret }),
      }).catch(() => {});
    setLink(null);
    setLocalError('');
  };
  useEffect(() => {
    if (!link) return;
    let active = true,
      checking = false;
    const poll = async () => {
      if (!active || checking) return;
      checking = true;
      try {
        const response = await fetch(`${SOCKET_URL}/api/device-link/status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ requestId: link.requestId, secret: link.secret }),
        });
        const data = await response.json();
        if (!active) return;
        if (!response.ok) throw new Error(data.error || 'Device link expired.');
        if (data.status === 'approved') {
          active = false;
          join(data);
        }
      } catch (error) {
        if (active) {
          setLocalError(error.message);
          setLink(null);
        }
      } finally {
        checking = false;
      }
    };
    const timer = setInterval(poll, 2500);
    poll();
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [link]);
  return (
    <div className="login-page relative h-[100dvh] w-full flex items-center justify-center overflow-hidden px-4 py-6 safe-top safe-bottom">
      <div className="login-story">
        <div className="pulse-mark">
          <span>p</span>
          <i />
        </div>
        <p className="eyebrow">YOUR PEOPLE. YOUR PACE. YOUR SPACE.</p>
        <h2>
          A little hello.
          <br />A <em>big possibility.</em>
        </h2>
        <p>
          Good conversations have a way of becoming great things. Bring your people, plans and files
          together in one thoughtful space.
        </p>
        <div>
          <span>✦ Up to 2 GB file sharing</span>
          <span>◷ Messages on your schedule</span>
          <span>☑ Plans that turn into progress</span>
        </div>
        <small>MAKE ROOM FOR WHAT’S NEXT.</small>
      </div>
      <div className="login-card relative w-full max-w-md glass-solid rounded-3xl p-5 sm:p-8 shadow-2xl animate-pop-in my-auto">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-brand-500 flex items-center justify-center text-white">
            <MessageCircle size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold">PulseChat</h1>
            <p className="text-xs text-slate-400">Room for a better conversation.</p>
          </div>
        </div>
        <h2 className="text-2xl font-semibold mb-2">Welcome to your space.</h2>
        <p className="text-sm text-slate-400 mb-6">
          Sign in securely with your Google account. Stay signed in on this device for at least 31
          days.
        </p>
        {(localError || error) && (
          <p role="alert" className="error-banner mb-4">
            {localError || error}
          </p>
        )}
        {loading ? (
          <p role="status" className="flex items-center justify-center gap-2 text-sm py-4">
            <Loader2 size={18} className="animate-spin" /> Connecting to sign-in?
          </p>
        ) : link ? (
          <div className="space-y-4">
            <p className="text-sm">
              On your signed-in device, open <strong>Profile ? Link another device</strong> and
              enter this code.
            </p>
            <p className="text-3xl font-bold tracking-[.22em] text-center select-all">
              {link.code}
            </p>
            <p role="status" className="text-xs text-slate-400">
              Waiting for approval. The pairing code expires in 5 minutes.
            </p>
            <button type="button" className="btn-secondary w-full" onClick={cancelLink}>
              Cancel
            </button>
          </div>
        ) : googleClientId ? (
          <div className="space-y-4">
            <GoogleSignInButton
              clientId={googleClientId}
              onCredential={signInGoogle}
              onError={(error) => setLocalError(error.message)}
              disabled={busy}
            />
            {busy && (
              <p role="status" className="text-sm text-center">
                Signing you in?
              </p>
            )}
            <button
              type="button"
              className="btn-secondary w-full"
              disabled={busy}
              onClick={startLink}
            >
              Link a device to your signed-in account
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="btn-primary w-full"
            onClick={() => setRetry((value) => value + 1)}
          >
            Retry connection
          </button>
        )}
      </div>
    </div>
  );
}
