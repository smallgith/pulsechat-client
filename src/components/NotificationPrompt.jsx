import { useState } from 'react';
import { Bell, X } from 'lucide-react';
import { getPermission, requestPermission } from '../lib/notification';

const DISMISS_KEY = 'pulsechat.notif.dismissed';

export default function NotificationPrompt() {
  const [hidden, setHidden] = useState(
    () =>
      localStorage.getItem(DISMISS_KEY) === '1' ||
      getPermission() !== 'default' ||
      !('Notification' in window)
  );
  const [busy, setBusy] = useState(false);

  if (hidden) return null;

  const enable = async () => {
    setBusy(true);
    const p = await requestPermission();
    setBusy(false);
    if (p === 'granted') setHidden(true);
  };

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1');
    setHidden(true);
  };

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[90]
                    glass rounded-2xl shadow-2xl border border-brand-500/30
                    px-4 py-3 flex items-center gap-3 max-w-[92vw] animate-fade-up">
      <div className="w-9 h-9 rounded-xl bg-brand-500/15 flex items-center justify-center shrink-0">
        <Bell className="w-4 h-4 text-brand-400" />
      </div>

      <div className="min-w-0">
        <p className="text-sm font-medium">Enable desktop notifications</p>
        <p className="text-[11px] text-slate-400">
          Miss na thay — naya messages turant dekhao
        </p>
      </div>

      <button
        onClick={enable}
        disabled={busy}
        className="shrink-0 px-3 py-1.5 rounded-lg bg-gradient-to-r from-brand-500 to-emerald-600
                   text-xs font-semibold shadow-lg shadow-brand-500/25
                   hover:brightness-110 active:scale-95 transition disabled:opacity-60"
      >
        {busy ? '...' : 'Enable'}
      </button>

      <button
        onClick={dismiss}
        className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-white/5 transition"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}