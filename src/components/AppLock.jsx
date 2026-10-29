import { useState } from 'react';
import { LockKeyhole, ArrowUpRight, ShieldCheck } from 'lucide-react';
import Modal from './Modal';

export default function AppLock({ lock, onClose, onLogout }) {
  const [pin, setPin] = useState(''),
    [confirm, setConfirm] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (lock.locked) await lock.unlock(pin);
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
          {lock.locked
            ? 'A little privacy, please.'
            : lock.enabled
              ? 'App lock is enabled'
              : 'Keep your conversations yours.'}
        </h3>
        <p className="text-sm text-slate-400 mt-2">
          {lock.locked
            ? 'Enter your PIN to return to your conversations.'
            : 'A screen lock for this browser. Locks after 5 minutes of inactivity and whenever you reopen the app.'}
        </p>
      </div>
      {error && (
        <p role="alert" className="error-banner">
          {error}
        </p>
      )}
      <label className="field-label">
        {lock.enabled ? 'Your PIN' : 'Choose a 6–8 digit PIN'}
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
      {!lock.enabled && (
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
        <button type="button" className="text-xs text-slate-400 w-full" onClick={onLogout}>
          Forgot your PIN? Log out and sign in again.
        </button>
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
