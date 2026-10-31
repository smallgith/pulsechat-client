const isPicture = m => !m.deleted && (m.file?.mime?.startsWith('image/') || m.file?.mime?.startsWith('video/') || !!m.gif);
/** Consecutive media from one sender in a 3-minute window, same calendar date. */
export function groupMedia(items) {
  const starts = new Map();
  const hidden = new Set();
  for (let i = 0; i < items.length;) {
    const first = items[i];
    if (!isPicture(first)) { i++; continue; }
    const cluster = [first];
    let j = i + 1;
    while (j < items.length && cluster.length < 10) {
      const next = items[j];
      const prev = items[j - 1];
      if (!isPicture(next) || next.from !== first.from || new Date(next.time).toDateString() !== new Date(first.time).toDateString() ||
        Math.abs(new Date(next.time) - new Date(prev.time)) > 3 * 60000 || next.text || (prev.text && prev !== first)) break;
      cluster.push(next); j++;
    }
    if (cluster.length > 1) {
      starts.set(first.id, cluster);
      cluster.slice(1).forEach(m => hidden.add(m.id));
    }
    i += cluster.length;
  }
  return { starts, hidden };
}
