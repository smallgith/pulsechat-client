import { useEffect, useState } from 'react';
import { Link2, Copy, RotateCcw, Shield, History, Tag, UsersRound } from 'lucide-react';

export default function GroupTools({ group: g, me, request, onClone }) {
  const [link, setLink] = useState(''),
    [tag, setTag] = useState(g.tags?.[me] || '');
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [copied, setCopied] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [settings, setSettings] = useState({
    adminsOnly: !!g.settings?.adminsOnly,
    memberInvites: !!g.settings?.memberInvites,
  });
  useEffect(() => {
    setSettings({
      adminsOnly: !!g.settings?.adminsOnly,
      memberInvites: !!g.settings?.memberInvites,
    });
  }, [g.settings?.adminsOnly, g.settings?.memberInvites]);
  const updateSetting = async (key, value) => {
    const previous = settings;
    const next = { ...settings, [key]: value };
    setSettings(next);
    setBusy(true);
    setError('');
    try {
      await request('group_settings', { id: g.id, ...next });
    } catch (e) {
      setSettings(previous);
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const admin = g.admins.includes(me);
  const run = async (fn) => {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const invite = (reset = false) =>
    run(async () => {
      const res = await request('group_invite', { id: g.id, reset });
      setLink(`${location.origin}/?invite=${res.token}`);
      setCopied(false);
    });
  return (
    <div className="space-y-4 border-t border-white/10 pt-4">
      {error && (
        <p role="alert" className="error-banner">
          {error}
        </p>
      )}
      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => request('member_tag', { id: g.id, tag }));
        }}
      >
        <label className="field-label flex-1">
          Your member tag
          <input
            className="field"
            placeholder="e.g. Designer"
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            maxLength={30}
          />
        </label>
        <button className="btn-secondary" disabled={busy}>
          <Tag size={15} />
          Save tag
        </button>
      </form>
      {(admin || g.settings?.memberInvites) && (
        <>
          <button className="btn-secondary w-full" disabled={busy} onClick={() => invite()}>
            <Link2 size={16} />
            Invite to group via link
          </button>
          {link && (
            <div className="p-3 rounded-xl bg-white/5 space-y-2">
              <input
                className="field !text-xs"
                aria-label="Group invite link"
                readOnly
                value={link}
                onFocus={(e) => e.target.select()}
              />
              <p className="text-[11px] text-slate-400">
                Valid for 7 days. Anyone with this link can join until an admin resets it.
              </p>
              <div className="flex gap-2">
                <button
                  className="btn-secondary flex-1"
                  onClick={() =>
                    run(async () => {
                      await navigator.clipboard.writeText(link);
                      setCopied(true);
                    })
                  }
                >
                  <Copy size={14} />
                  {copied ? 'Copied' : 'Copy link'}
                </button>
                {admin && (
                  <button className="btn-secondary" disabled={busy} onClick={() => invite(true)}>
                    <RotateCcw size={14} />
                    Reset
                  </button>
                )}
              </div>
            </div>
          )}
        </>
      )}
      {admin && (
        <div className="board-item space-y-3">
          <p className="eyebrow flex gap-2 items-center">
            <Shield size={14} />
            GROUP PERMISSIONS
          </p>
          <label className="flex justify-between items-center gap-3 text-sm">
            <span>Only admins can send messages</span>
            <input
              type="checkbox"
              checked={settings.adminsOnly}
              disabled={busy}
              onChange={(e) => updateSetting('adminsOnly', e.target.checked)}
            />
          </label>
          <label className="flex justify-between items-center gap-3 text-sm">
            <span>Members can create invite links</span>
            <input
              type="checkbox"
              checked={settings.memberInvites}
              disabled={busy}
              onChange={(e) => updateSetting('memberInvites', e.target.checked)}
            />
          </label>
        </div>
      )}
      <button className="btn-secondary w-full" onClick={() => onClone(g)}>
        <UsersRound size={16} />
        Create a similar group
      </button>
      <button className="btn-secondary w-full" onClick={() => setHistoryOpen(!historyOpen)}>
        <History size={16} />
        {historyOpen ? 'Hide' : 'See'} member changes
      </button>
      {historyOpen && (
        <div className="space-y-3 max-h-52 overflow-y-auto scroll-thin">
          {(g.activity || [])
            .slice()
            .reverse()
            .map((a) => (
              <div key={a.id} className="text-xs border-l-2 border-brand-500/40 pl-3">
                <p>{a.text}</p>
                <p className="text-slate-500 mt-1">{new Date(a.at).toLocaleString()}</p>
              </div>
            ))}
          {!g.activity?.length && (
            <p className="text-xs text-slate-400">New member changes will appear here.</p>
          )}
        </div>
      )}
    </div>
  );
}
