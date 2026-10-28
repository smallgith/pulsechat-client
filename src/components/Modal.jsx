import { useEffect } from 'react';
import { X } from 'lucide-react';

export default function Modal({ title, onClose, children, wide = false }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);
  return <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-3" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-label={title} className={`glass-solid rounded-2xl shadow-2xl w-full ${wide ? 'max-w-2xl' : 'max-w-md'} max-h-[90dvh] flex flex-col overflow-hidden`}>
      <header className="flex items-center gap-3 p-4 border-b border-white/10"><h2 className="font-semibold flex-1">{title}</h2><button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10" aria-label="Close dialog"><X size={18} /></button></header>
      <div className="p-4 overflow-y-auto scroll-thin space-y-4">{children}</div>
    </section>
  </div>;
}
