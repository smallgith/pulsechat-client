import { avatarGradient, initials } from '../lib/avatar';

export default function Avatar({ name = '', size = 44, online = false, ring = false }) {
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <div
        className={`w-full h-full rounded-full flex items-center justify-center font-semibold text-white select-none ${
          ring ? 'ring-2 ring-brand-500/40' : ''
        }`}
        style={{
          background: avatarGradient(name),
          fontSize: size * 0.38,
          boxShadow: '0 4px 14px rgba(0,0,0,.35)',
        }}
      >
        {initials(name)}
      </div>

      {online && (
        <span
          className="absolute bottom-0 right-0 rounded-full bg-brand-400 border-2 border-ink-800"
          style={{ width: size * 0.28, height: size * 0.28 }}
        />
      )}
    </div>
  );
}