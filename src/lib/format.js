export const formatTime = (iso) =>
  new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export const formatBytes = (bytes = 0) => {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)} ${sizes[i]}`;
};

export const dayLabel = (iso) => {
  const d = new Date(iso);
  const today = new Date();
  const yest = new Date();
  yest.setDate(today.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yest.toDateString()) return 'Yesterday';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

export const groupByDay = (messages = []) => {
  const groups = [];
  messages.forEach((m) => {
    const label = dayLabel(m.time);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(m);
    else groups.push({ label, items: [m] });
  });
  return groups;
};

export const shortPreview = (msg) => {
  if (!msg) return '';
  if (msg.file) {
    const isImg = msg.file.mime?.startsWith('image/');
    return `${isImg ? '📷' : '📎'} ${msg.text || msg.file.name}`;
  }
  return msg.text || '';
};