import { useEffect, useRef } from 'react';

export default function ContextMenu({ x, y, items, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    const onDoc = (e) => {
      if (!ref.current?.contains(e.target)) onClose();
    };
    const onEsc = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onEsc);
    };
  }, [onClose]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let nx = x;
    let ny = y;
    if (x + rect.width > vw - 8) nx = vw - rect.width - 8;
    if (y + rect.height > vh - 8) ny = vh - rect.height - 8;
    el.style.left = `${nx}px`;
    el.style.top = `${ny}px`;
  }, [x, y]);

  return (
    <div
      ref={ref}
      className="fixed z-[110] min-w-[180px] py-1.5 glass rounded-xl shadow-2xl border border-white/10 animate-pop-in"
      style={{ left: x, top: y }}
    >
      {items.map((it, i) =>
        it.divider ? (
          <div key={i} className="h-px my-1.5 bg-white/10" />
        ) : (
          <button
            key={i}
            onClick={() => { it.onClick?.(); onClose(); }}
            className={`w-full flex items-center gap-3 px-3 py-2 text-sm text-left transition ${
              it.danger
                ? 'text-red-400 hover:bg-red-500/10'
                : 'text-slate-200 hover:bg-white/5'
            }`}
          >
            {it.icon && <it.icon className="w-4 h-4 shrink-0" />}
            <span className="flex-1">{it.label}</span>
          </button>
        )
      )}
    </div>
  );
}