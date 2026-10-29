import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export default function Modal({ title, onClose, children, wide = false }) {
  const panel = useRef(),
    closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement;
    const selector =
      'button:not(:disabled),input:not(:disabled):not([type="hidden"]),textarea:not(:disabled),select:not(:disabled),a[href]';
    if (!panel.current?.contains(document.activeElement))
      panel.current?.querySelector(selector)?.focus();
    const handler = (e) => {
      if (e.key === 'Escape') closeRef.current();
      if (e.key !== 'Tab') return;
      const elements = [...(panel.current?.querySelectorAll(selector) || [])].filter(
        (el) => el.offsetParent !== null
      );
      const first = elements[0],
        last = elements.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener('keydown', handler);
    return () => {
      document.removeEventListener('keydown', handler);
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return (
    <div
      className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-3"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`glass-solid rounded-2xl shadow-2xl w-full ${wide ? 'max-w-2xl' : 'max-w-md'} max-h-[90dvh] flex flex-col overflow-hidden`}
      >
        <header className="flex items-center gap-3 p-4 border-b border-white/10">
          <h2 className="font-semibold flex-1">{title}</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10"
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </header>
        <div className="p-4 overflow-y-auto scroll-thin space-y-4">{children}</div>
      </section>
    </div>
  );
}
