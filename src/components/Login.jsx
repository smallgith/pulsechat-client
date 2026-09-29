import { useState, useRef, useEffect } from 'react';
import { MessageCircle, ArrowRight, Smartphone, Shield, User, Loader2, CheckCircle2 } from 'lucide-react';
import Avatar from './Avatar';
import { SOCKET_URL } from '../lib/socket';

export default function Login({ onJoin, error }) {
  const [step, setStep] = useState('phone'); // phone | otp | name
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [localErr, setLocalErr] = useState('');
  const [resendIn, setResendIn] = useState(0);

  const otpRefs = useRef([]);
  const timerRef = useRef(null);

  useEffect(() => () => clearInterval(timerRef.current), []);

  const startResendTimer = () => {
    setResendIn(30);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setResendIn((s) => {
        if (s <= 1) { clearInterval(timerRef.current); return 0; }
        return s - 1;
      });
    }, 1000);
  };

  /* ------------ send OTP ------------ */
  const sendOtp = async (e) => {
    e?.preventDefault();
    setLocalErr('');
    if (!/^\d{10}$/.test(phone)) {
      setLocalErr('Enter a valid 10-digit mobile number');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`${SOCKET_URL}/api/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'Failed to send OTP');
      setStep('otp');
      setOtp(['', '', '', '', '', '']);
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
      startResendTimer();
    } catch (err) {
      setLocalErr(err.message);
    } finally {
      setBusy(false);
    }
  };

  const resendOtp = async () => {
    if (resendIn > 0) return;
    setBusy(true);
    setLocalErr('');
    try {
      await fetch(`${SOCKET_URL}/api/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      startResendTimer();
    } finally {
      setBusy(false);
    }
  };

  /* ------------ OTP input handling ------------ */
  const handleOtpChange = (i, v) => {
    const digit = v.replace(/\D/g, '').slice(-1);
    const next = [...otp];
    next[i] = digit;
    setOtp(next);
    if (digit && i < 5) otpRefs.current[i + 1]?.focus();
  };

  const handleOtpKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !otp[i] && i > 0) otpRefs.current[i - 1]?.focus();
    if (e.key === 'ArrowLeft' && i > 0) otpRefs.current[i - 1]?.focus();
    if (e.key === 'ArrowRight' && i < 5) otpRefs.current[i + 1]?.focus();
  };

  const handleOtpPaste = (e) => {
    const text = (e.clipboardData?.getData('text') || '').replace(/\D/g, '').slice(0, 6);
    if (!text) return;
    e.preventDefault();
    const next = ['', '', '', '', '', ''];
    text.split('').forEach((d, i) => { next[i] = d; });
    setOtp(next);
    const lastIdx = Math.min(text.length, 5);
    otpRefs.current[lastIdx]?.focus();
  };

  /* ------------ verify OTP ------------ */
  const verifyOtp = async (e) => {
    e?.preventDefault();
    setLocalErr('');
    const code = otp.join('');
    if (code.length !== 6) {
      setLocalErr('Enter the 6-digit OTP');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`${SOCKET_URL}/api/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, otp: code }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'Invalid OTP');
      setStep('name');
    } catch (err) {
      setLocalErr(err.message);
    } finally {
      setBusy(false);
    }
  };

  /* ------------ complete registration ------------ */
  const finish = (e) => {
    e.preventDefault();
    setLocalErr('');
    const n = name.trim();
    if (n.length < 2) {
      setLocalErr('Name must be at least 2 characters');
      return;
    }
    onJoin({ phone, name: n });
  };

  /* ============== RENDER ============== */
  return (
    <div className="relative min-h-full flex items-center justify-center overflow-hidden px-4 py-8">
      <div className="absolute -top-40 -left-40 w-[28rem] h-[28rem] rounded-full bg-brand-500/20 blur-[120px]" />
      <div className="absolute -bottom-40 -right-40 w-[28rem] h-[28rem] rounded-full bg-indigo-500/20 blur-[120px]" />

      <div className="relative w-full max-w-md glass rounded-3xl p-8 shadow-2xl animate-pop-in">
        {/* logo */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-brand-500/30">
            <MessageCircle className="w-6 h-6 text-white" strokeWidth={2.4} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">PulseChat</h1>
            <p className="text-xs text-slate-400">Premium real-time messaging</p>
          </div>
        </div>

        {/* step indicator */}
        <div className="flex items-center gap-2 mb-6">
          {['phone', 'otp', 'name'].map((s, i) => {
            const idx = ['phone', 'otp', 'name'].indexOf(step);
            const done = i < idx;
            const active = i === idx;
            return (
              <div key={s} className="flex items-center gap-2 flex-1">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition ${
                    done
                      ? 'bg-brand-500 text-ink-900'
                      : active
                        ? 'bg-brand-500/20 text-brand-400 ring-2 ring-brand-500/40'
                        : 'bg-white/5 text-slate-500'
                  }`}
                >
                  {done ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
                </div>
                {i < 2 && (
                  <div className={`flex-1 h-0.5 rounded ${done ? 'bg-brand-500' : 'bg-white/10'}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* ---- STEP 1: PHONE ---- */}
        {step === 'phone' && (
          <form onSubmit={sendOtp} className="space-y-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5" /> Mobile Number
              </label>
              <div className="flex items-center rounded-xl bg-ink-900/70 border border-white/10 focus-within:border-brand-500/60 focus-within:ring-4 focus-within:ring-brand-500/10 transition overflow-hidden">
                <span className="px-3 py-3.5 text-slate-300 font-medium border-r border-white/5">+91</span>
                <input
                  autoFocus
                  inputMode="numeric"
                  maxLength={10}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                  placeholder="9876543210"
                  className="flex-1 px-3 py-3.5 bg-transparent outline-none placeholder-slate-500"
                />
              </div>
            </div>

            {(localErr || error) && (
              <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {localErr || error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy || phone.length !== 10}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gradient-to-r from-brand-500 to-emerald-600 font-semibold shadow-lg shadow-brand-500/25 transition hover:brightness-110 active:scale-[.98] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Send OTP <ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>
        )}

        {/* ---- STEP 2: OTP ---- */}
        {step === 'otp' && (
          <form onSubmit={verifyOtp} className="space-y-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5" /> Verification Code
              </label>
              <p className="text-xs text-slate-400 mb-3">
                Sent to <span className="text-slate-200 font-medium">+91 {phone}</span>
              </p>

              <div className="flex gap-2 justify-between" onPaste={handleOtpPaste}>
                {otp.map((d, i) => (
                  <input
                    key={i}
                    ref={(el) => (otpRefs.current[i] = el)}
                    inputMode="numeric"
                    maxLength={1}
                    value={d}
                    onChange={(e) => handleOtpChange(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(i, e)}
                    className="w-12 h-14 text-center text-xl font-semibold rounded-xl bg-ink-900/70 border border-white/10 outline-none transition focus:border-brand-500/60 focus:ring-4 focus:ring-brand-500/10"
                  />
                ))}
              </div>

              <div className="mt-3 flex items-center justify-between text-xs">
                <span className="text-slate-500">
                  💡 Demo OTP: <span className="text-brand-400 font-mono font-semibold">111111</span>
                </span>
                <button
                  type="button"
                  onClick={resendOtp}
                  disabled={resendIn > 0 || busy}
                  className="text-brand-400 hover:underline disabled:opacity-50 disabled:no-underline"
                >
                  {resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend OTP'}
                </button>
              </div>
            </div>

            {localErr && (
              <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {localErr}
              </p>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep('phone')}
                className="px-4 py-3.5 rounded-xl bg-white/5 hover:bg-white/10 text-sm font-medium transition"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={busy || otp.join('').length !== 6}
                className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gradient-to-r from-brand-500 to-emerald-600 font-semibold shadow-lg shadow-brand-500/25 transition hover:brightness-110 active:scale-[.98] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Verify <ArrowRight className="w-4 h-4" /></>}
              </button>
            </div>
          </form>
        )}

        {/* ---- STEP 3: NAME ---- */}
        {step === 'name' && (
          <form onSubmit={finish} className="space-y-4">
            <div className="flex justify-center">
              <Avatar name={name || 'You'} size={84} ring />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" /> Display Name
              </label>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Aarav Patel"
                maxLength={24}
                className="w-full px-4 py-3.5 rounded-xl bg-ink-900/70 border border-white/10 text-slate-100 placeholder-slate-500 outline-none transition focus:border-brand-500/60 focus:ring-4 focus:ring-brand-500/10"
              />
            </div>

            {localErr && (
              <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {localErr}
              </p>
            )}

            <button
              type="submit"
              disabled={name.trim().length < 2}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gradient-to-r from-brand-500 to-emerald-600 font-semibold shadow-lg shadow-brand-500/25 transition hover:brightness-110 active:scale-[.98] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Start chatting <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
}