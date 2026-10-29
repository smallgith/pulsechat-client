import { useState } from 'react';
import { Link2, ShieldCheck } from 'lucide-react';
import Modal from './Modal';
import { SOCKET_URL, authHeaders } from '../lib/socket';

export default function DeviceLinkApproval({ onClose }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [approved, setApproved] = useState(false);
  const approve = async (event) => {
    event.preventDefault();
    setBusy(true); setError('');
    try {
      const res = await fetch(`${SOCKET_URL}/api/device-link/approve`, {
        method: 'POST', headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Unable to link this device');
      setApproved(true);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };
  return <Modal title="Connect another device" onClose={onClose}>
    <div className="space-y-4">
      <p className="text-sm text-slate-400">On your second phone or computer, select <strong>Link an existing account</strong> on the login screen. Type its 8-digit code below.</p>
      <p className="text-xs text-slate-400">Only approve a code that you can see on a device you own. This grants account access without another SMS code.</p>
      {approved ? <div role="status" className="text-sm rounded-xl p-3 bg-emerald-500/10 border border-emerald-500/30 flex gap-2 items-center"><ShieldCheck size={20}/> Device approved. Return to the new device to finish signing in.</div>
        : <form className="space-y-3" onSubmit={approve}>
          <label className="field-label">Code shown on your other device
            <input className="field text-center tracking-[.3em] text-xl" inputMode="numeric" autoComplete="off" maxLength={8} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0,8))} placeholder="12345678" required />
          </label>
          {error && <p role="alert" className="error-banner">{error}</p>}
          <button disabled={busy || code.length !== 8} className="btn-primary w-full"><Link2 size={17}/>{busy ? 'Approving…' : 'Approve this device'}</button>
        </form>}
    </div>
  </Modal>;
}
