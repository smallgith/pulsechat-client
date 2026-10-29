import { useEffect, useRef, useState } from 'react';
import { discardTransfer, SOCKET_URL, TransferControl, uploadFile } from '../lib/socket';

export function useAttachments() {
  const [items, setItems] = useState([]),
    [error, setError] = useState('');
  const [limits, setLimits] = useState({ maxFileSize: 2 * 1024 ** 3, maxFiles: 20 });
  const ref = useRef([]),
    alive = useRef(true);
  const update = (id, values) => {
    ref.current = ref.current.map((i) => (i.id === id ? { ...i, ...values } : i));
    if (alive.current) setItems(ref.current);
  };
  useEffect(() => {
    alive.current = true;
    fetch(`${SOCKET_URL}/api/config`)
      .then((r) => r.json())
      .then((data) => {
        if (alive.current && data.maxFileSize) setLimits(data);
      })
      .catch(() => {});
    return () => {
      alive.current = false;
      ref.current.forEach((i) => {
        i.control.cancel();
        if (i.preview) URL.revokeObjectURL(i.preview);
      });
    };
  }, []);
  const add = (list) => {
    const files = [...list]
      .filter((f) => f.size > 0 && f.size <= limits.maxFileSize)
      .slice(0, limits.maxFiles - ref.current.length);
    setError(
      files.length !== list.length
        ? `Choose up to ${limits.maxFiles} non-empty files, each no larger than ${Math.floor(limits.maxFileSize / 1024 ** 2)} MB.`
        : ''
    );
    ref.current = [
      ...ref.current,
      ...files.map((file) => ({
        id: crypto.randomUUID(),
        file,
        preview:
          file.type.startsWith('image/') && file.size < 40 * 1024 ** 2
            ? URL.createObjectURL(file)
            : null,
        status: 'ready',
        progress: 0,
        control: new TransferControl(),
        meta: null,
      })),
    ];
    setItems(ref.current);
  };
  const remove = (id) => {
    const item = ref.current.find((i) => i.id === id);
    if (!item) return;
    discardTransfer(item.control);
    if (item.preview) URL.revokeObjectURL(item.preview);
    ref.current = ref.current.filter((i) => i.id !== id);
    setItems(ref.current);
  };
  const pause = (id) => {
    ref.current.find((i) => i.id === id)?.control.pause();
    update(id, { status: 'paused' });
  };
  const resume = (id) => {
    ref.current.find((i) => i.id === id)?.control.resume();
    update(id, { status: 'uploading' });
  };
  const uploadAll = async () => {
    const pending = [...ref.current],
      results = new Map();
    let cursor = 0;
    const worker = async () => {
      while (cursor < pending.length) {
        const item = pending[cursor++];
        if (!ref.current.some((i) => i.id === item.id)) continue;
        if (item.meta) {
          results.set(item.id, item.meta);
          continue;
        }
        if (item.control.cancelled) item.control = new TransferControl();
        try {
          const meta = await uploadFile(
            item.file,
            (progress) => update(item.id, { progress }),
            item.control,
            (status) => update(item.id, { status })
          );
          results.set(item.id, meta);
          update(item.id, { status: 'uploaded', meta });
        } catch (e) {
          if (!e.cancelled) {
            update(item.id, { status: 'error', error: e.message });
            throw e;
          }
        }
      }
    };
    const settled = await Promise.allSettled([worker(), worker()]);
    const failed = settled.find((r) => r.status === 'rejected');
    if (failed) throw failed.reason;
    if (!alive.current) throw new Error('Transfer paused. Reselect the same file to resume.');
    return ref.current
      .filter((i) => results.has(i.id))
      .map((i) => ({ ...results.get(i.id), transferKey: i.id }));
  };
  const clear = () => {
    ref.current.forEach((i) => {
      if (i.preview) URL.revokeObjectURL(i.preview);
    });
    ref.current = [];
    setItems([]);
  };
  return { items, error, limits, add, remove, pause, resume, uploadAll, clear };
}
