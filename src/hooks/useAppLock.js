import { useCallback, useEffect, useRef, useState } from 'react';

const bytes = (hex) => Uint8Array.from(hex.match(/.{1,2}/g) || [], (v) => parseInt(v, 16));
const hex = (data) =>
  [...new Uint8Array(data)].map((v) => v.toString(16).padStart(2, '0')).join('');
async function hashPin(pin, salt) {
  if (!crypto.subtle) throw new Error('App lock needs HTTPS or localhost.');
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, [
    'deriveBits',
  ]);
  return hex(
    await crypto.subtle.deriveBits(
      { name: 'PBKDF2', hash: 'SHA-256', salt: bytes(salt), iterations: 150000 },
      key,
      256
    )
  );
}
export function useAppLock(phone, suspended = false) {
  const key = `pulsechat.lock.${phone}`;
  const [record, setRecord] = useState(null),
    [locked, setLocked] = useState(false);
  const timer = useRef(),
    failures = useRef(0),
    blockedUntil = useRef(0);
  useEffect(() => {
    try {
      const value = JSON.parse(localStorage.getItem(key) || 'null');
      setRecord(value);
      setLocked(!!value);
    } catch {
      setRecord(null);
    }
  }, [key]);
  const lock = useCallback(() => {
    if (record) setLocked(true);
  }, [record]);
  useEffect(() => {
    if (!record || locked || suspended) return;
    const reset = () => {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setLocked(true), 5 * 60000);
    };
    reset();
    window.addEventListener('pointerdown', reset);
    window.addEventListener('keydown', reset);
    return () => {
      clearTimeout(timer.current);
      window.removeEventListener('pointerdown', reset);
      window.removeEventListener('keydown', reset);
    };
  }, [record, locked, suspended]);
  const setup = async (pin) => {
    if (!/^\d{6,8}$/.test(pin)) throw new Error('Choose a PIN with 6–8 digits.');
    const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
    const next = { salt, hash: await hashPin(pin, salt) };
    localStorage.setItem(key, JSON.stringify(next));
    setRecord(next);
  };
  const unlock = async (pin) => {
    if (blockedUntil.current > Date.now()) throw new Error('Wait 30 seconds before trying again.');
    if ((await hashPin(pin, record.salt)) !== record.hash) {
      if (++failures.current >= 5) {
        blockedUntil.current = Date.now() + 30000;
        failures.current = 0;
      }
      throw new Error('Incorrect PIN');
    }
    failures.current = 0;
    setLocked(false);
  };
  const disable = async (pin) => {
    await unlock(pin);
    localStorage.removeItem(key);
    setRecord(null);
  };
  const forget = () => {
    localStorage.removeItem(key);
    setRecord(null);
    setLocked(false);
  };
  return { enabled: !!record, locked, lock, setup, unlock, disable, forget };
}
