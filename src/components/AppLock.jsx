import { useEffect, useState } from 'react';
import { LockKeyhole, ArrowUpRight, ShieldCheck } from 'lucide-react';
import Modal from './Modal';
import GoogleSignInButton from './GoogleSignInButton';
import { authHeaders, SOCKET_URL } from '../lib/socket';

export default function AppLock({ lock, onClose, onLogout }) {
  const [pin, setPin] = useState(''),
    [confirm, setConfirm] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const [resetting, setResetting] = useState(false);
  const [googleClientId, setGoogleClientId] = useState('');
  const [googleCredential, setGoogleCredential] = useState('');
  useEffect(() => {
    fetch(`${SOCKET_URL}/api/config`)
      .then((r) => r.json())
      .then((data) => {
        setGoogleClientId(data.googleClientId || '');
      })
      .catch(() => {});
  }, []);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (lock.locked && resetting) {
        if (pin !== confirm) throw new Error('The PINs do not match.');
        const token = authHeaders().Authorization?.replace(/^Bearer /, '');
        if (!googleCredential) throw new Error('Verify your Google account first.');
        await lock.resetPin(googleCredential, pin, token);
        setResetting(false);
      } else if (lock.locked) await lock.unlock(pin);
      else if (lock.enabled) {
        await lock.disable(pin);
        onClose();
      } else {
        if (pin !== confirm) throw new Error('The PINs do not match.');
        await lock.setup(pin);
        onClose();
      }
      setPin('');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const content = (
    <form onSubmit={submit} className="space-y-5">
      <div className="lock-orb">
        <LockKeyhole size={30} />
      </div>
      <div className="text-center">
        <h3 className="text-xl font-semibold">
          {lock.locked && resetting
            ? 'Verify and reset your PIN'
            : lock.locked
              ? 'A little privacy, please.'
              : lock.enabled
                ? 'App lock is enabled'
                : 'Keep your conversations yours.'}
        </h3>
        <p className="text-sm text-slate-400 mt-2">
          {lock.locked && resetting
            ? 'Confirm your Google identity before selecting a new PIN.'
            : lock.locked
              ? 'Enter your PIN to return to your conversations.'
              : 'A screen lock for this browser. Locks after 5 minutes of inactivity and whenever you reopen the app.'}
        </p>
      </div>
      {error && (
        <p role="alert" className="error-banner">
          {error}
        </p>
      )}
      {lock.locked && resetting && (
        <div className="space-y-3">
          <GoogleSignInButton
            clientId={googleClientId}
            onCredential={setGoogleCredential}
            onError={(e) => setError(e.message)}
            disabled={busy}
          />
          {googleCredential && (
            <p className="text-xs text-brand-400">
              Google sign-in received. Your identity will be verified when you save.
            </p>
          )}
        </div>
      )}
      <label className="field-label">
        {resetting ? 'New 6–8 digit PIN' : lock.enabled ? 'Your PIN' : 'Choose a 6–8 digit PIN'}
        <input
          className="field text-center tracking-[.5em]"
          autoComplete="off"
          autoFocus
          type="password"
          inputMode="numeric"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
          minLength={6}
          maxLength={8}
          required
        />
      </label>
      {(!lock.enabled || resetting) && (
        <label className="field-label">
          Confirm PIN
          <input
            className="field text-center tracking-[.5em]"
            type="password"
            inputMode="numeric"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value.replace(/\D/g, '').slice(0, 8))}
            minLength={6}
            maxLength={8}
            required
          />
        </label>
      )}
      <button className="btn-primary w-full" disabled={busy}>
        {busy
          ? 'Checking…'
          : lock.locked && resetting
            ? 'Verify and save new PIN'
            : lock.locked
              ? 'Unlock workspace'
              : lock.enabled
                ? 'Disable app lock'
                : 'Enable app lock'}
        <ArrowUpRight size={16} />
      </button>
      {lock.enabled && !lock.locked && (
        <button
          type="button"
          className="btn-secondary w-full"
          onClick={() => {
            onClose();
            lock.lock();
          }}
        >
          Lock now
        </button>
      )}
      {lock.locked ? (
        <div className="space-y-2">
          {lock.wrongAttempts >= 3 && (
            <button
              type="button"
              className="btn-secondary w-full"
              onClick={() => {
                setResetting(!resetting);
                setError('');
              }}
            >
              {resetting ? 'Use existing PIN' : 'Forgot PIN? Verify Google account and reset'}
            </button>
          )}
          <button type="button" className="text-xs text-slate-400 w-full" onClick={onLogout}>
            Log out and sign in again
          </button>
        </div>
      ) : (
        <p className="text-[11px] text-slate-500 flex gap-2">
          <ShieldCheck size={18} className="shrink-0" />
          This protects the screen on this device. It does not encrypt stored messages or replace
          device security. Clear this site's local app-lock setting if you forget the PIN.
        </p>
      )}
    </form>
  );
  if (lock.locked)
    return (
      <div className="h-[100dvh] flex items-center justify-center p-5 chat-bg">
        <div className="lock-screen">{content}</div>
      </div>
    );
  return (
    <Modal title="App lock" onClose={onClose}>
      {content}
    </Modal>
  );
}
