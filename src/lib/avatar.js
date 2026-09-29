const COLORS = [
  '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4',
  '#10b981', '#ec4899', '#3b82f6', '#f97316',
  '#14b8a6', '#a855f7',
];

const hash = (str = '') => {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return Math.abs(h);
};

export const avatarGradient = (name = '') => {
  const h = hash(name);
  const c1 = COLORS[h % COLORS.length];
  const c2 = COLORS[(h * 7 + 3) % COLORS.length];
  return `linear-gradient(135deg, ${c1}, ${c2})`;
};

export const initials = (name = '') =>
  name
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || '?';