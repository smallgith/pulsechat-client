import { initials } from '../lib/avatar';

export default function Avatar({ name = '', size = 44, online = false, ring = false, src, color, variant = 'initials', focus = 50 }) {
  const symbol = { orbit: '◈', sparkle: '✦', bloom: '✿' }[variant];
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <div
        className={`w-full h-full rounded-full flex items-center justify-center font-semibold text-white select-none overflow-hidden ${ring ? 'ring-2 ring-brand-500/40' : ''}`}
        style={{ background: color || '#7050cc', fontSize: size * (symbol ? .58 : .38), boxShadow: '0 4px 14px rgba(0,0,0,.13)' }}
      >
        {src ? <img src={src} alt={`${name} profile`} className="w-full h-full object-cover" style={{ objectPosition: `50% ${focus}%` }} loading="lazy" /> : (symbol || initials(name))}
      </div>
      {online && (
        <span className="absolute bottom-0 right-0 rounded-full bg-brand-400 border-2 border-ink-800"
          style={{ width: size * .28, height: size * .28 }} />
      )}
    </div>
  );
}
