import { AlertTriangle, X } from 'lucide-react';

export default function ConfirmDialog({
  open,
  title = 'Are you sure?',
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  onConfirm,
  onCancel,
  children,
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-pop-in">
      <div className="w-full max-w-sm glass rounded-2xl shadow-2xl border border-white/10 overflow-hidden">
        <div className="flex items-start gap-3 p-5 pb-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              danger ? 'bg-red-500/15 text-red-400' : 'bg-brand-500/15 text-brand-400'
            }`}
          >
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-[15px] mb-1">{title}</h3>
            {message && <p className="text-sm text-slate-400">{message}</p>}
          </div>
          <button
            onClick={onCancel}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-white/5"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {children && <div className="px-5 pb-3">{children}</div>}

        <div className="flex gap-2 p-4 pt-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-sm font-medium transition"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition active:scale-[.98] ${
              danger
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-gradient-to-r from-brand-500 to-emerald-600 text-white shadow-lg shadow-brand-500/20'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}