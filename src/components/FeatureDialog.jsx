import { useEffect, useState } from 'react';
import { Phone, Video, Users, Star, Check, Trash2, Plus, Eye } from 'lucide-react';
import Modal from './Modal';
import Avatar from './Avatar';
import { formatTime, shortPreview } from '../lib/format';
import { getPermission, requestPermission } from '../lib/notification';
import { enablePush } from '../lib/push';
import GroupTools from './GroupTools';

export default function FeatureDialog({
  dialog,
  onClose,
  me,
  users,
  groups,
  statuses,
  calls,
  messages,
  preferences,
  request,
  onSelect,
  onCall,
  onForward,
  onNotice,
  onFeature,
}) {
  const [name, setName] = useState(dialog.user?.name || me.name);
  const [about, setAbout] = useState(dialog.user?.description ?? me.about ?? 'Available');
  const [text, setText] = useState(dialog.message?.text || '');
  const [color, setColor] = useState('#047857');
  const [members, setMembers] = useState([]);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const [viewing, setViewing] = useState(null);
  const [notificationResult, setNotificationResult] = useState('');
  const user = dialog.user;
  const group = groups.find((g) => g.phone === user?.phone);
  const contacts = users.filter((u) => u.phone !== me.phone);
  const run = async (action, close = true) => {
    setBusy(true);
    setError('');
    try {
      await action();
      if (close) onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    if (dialog.type === 'group_create') {
      setName(dialog.source ? `${dialog.source.name} · new` : '');
      setAbout(dialog.source?.description || '');
      setMembers(dialog.source?.members.filter((p) => p !== me.phone) || []);
    }
  }, [dialog.type]);
  const submit = (e, action) => {
    e.preventDefault();
    if (!busy) run(action);
  };
  const primary = (label) => (
    <button disabled={busy} className="btn-primary w-full">
      {busy ? 'Saving…' : label}
    </button>
  );
  const person = (p) => users.find((u) => u.phone === p) || { phone: p, name: p };
  const titles = {
    profile: 'Your profile',
    group_create: 'New group',
    contact: group ? 'Group info' : 'Contact info',
    forward: 'Forward messages',
    edit: 'Edit message',
    timer: 'Disappearing messages',
    statuses: 'Status updates',
    calls: 'Call history',
    starred: 'Starred messages',
    media: 'Shared media & files',
  };
  return (
    <Modal
      title={titles[dialog.type] || 'Chat'}
      onClose={onClose}
      wide={dialog.type === 'statuses'}
    >
      {error && (
        <p role="alert" className="text-sm text-red-400 bg-red-500/10 p-3 rounded-xl">
          {error}
        </p>
      )}
      {dialog.type === 'profile' && (
        <form
          className="space-y-4"
          onSubmit={(e) => submit(e, () => request('profile', { name, about }))}
        >
          <div className="flex justify-center">
            <Avatar name={name} size={80} />
          </div>
          <p className="text-center text-slate-400 text-sm">{me.phone}</p>
          <label className="field-label">
            Display name
            <input
              className="field"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={30}
              minLength={2}
              required
            />
          </label>
          <label className="field-label">
            About
            <textarea
              className="field"
              value={about}
              onChange={(e) => setAbout(e.target.value)}
              maxLength={140}
            />
          </label>
          {primary('Save profile')}
          {getPermission() !== 'unsupported' && (
            <button
              type="button"
              className="btn-secondary w-full"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const permission = await requestPermission();
                  if (permission === 'granted') {
                    const enabled = await enablePush();
                    setNotificationResult(
                      enabled
                        ? 'Live and background notifications enabled.'
                        : 'Browser alerts enabled. Background push is not supported in this browser.'
                    );
                  } else
                    setNotificationResult(
                      'Allow notifications for this site in your browser settings.'
                    );
                } catch (e) {
                  setNotificationResult(e.message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Enable notifications
            </button>
          )}
          {notificationResult && <p className="text-xs text-slate-300">{notificationResult}</p>}
          <button
            type="button"
            className="btn-secondary w-full"
            onClick={() => onFeature('security')}
          >
            App lock
          </button>
          <button type="button" className="btn-secondary w-full" onClick={() => onFeature('theme')}>
            Change appearance
          </button>
          {users.find((u) => u.phone === me.phone)?.isFounder && (
            <button
              type="button"
              className="btn-secondary w-full"
              onClick={() => onFeature('reports')}
            >
              Review reported conversations
            </button>
          )}
        </form>
      )}
      {dialog.type === 'group_create' && (
        <form
          className="space-y-4"
          onSubmit={(e) =>
            submit(e, async () => {
              const res = await request('create_group', { name, description: about, members });
              onSelect(res.group);
            })
          }
        >
          <label className="field-label">
            Group name
            <input
              className="field"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              minLength={2}
              required
              autoFocus
            />
          </label>
          <label className="field-label">
            Description
            <input
              className="field"
              value={about}
              onChange={(e) => setAbout(e.target.value)}
              maxLength={240}
            />
          </label>
          <p className="text-sm text-slate-400">Select members · {members.length} selected</p>
          {!contacts.length && (
            <p className="text-sm text-slate-400">Ask a friend to sign in, then add them here.</p>
          )}
          {contacts
            .filter((u) => !preferences.blocked.includes(u.phone))
            .map((u) => (
              <label
                key={u.phone}
                className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={members.includes(u.phone)}
                  onChange={(e) =>
                    setMembers((prev) =>
                      e.target.checked ? [...prev, u.phone] : prev.filter((p) => p !== u.phone)
                    )
                  }
                />
                <Avatar name={u.name} size={36} />
                <span>
                  {u.name}
                  <small className="block text-slate-500">{u.phone}</small>
                </span>
              </label>
            ))}
          {primary('Create group')}
        </form>
      )}
      {dialog.type === 'contact' && (
        <>
          <div className="flex flex-col items-center gap-2">
            <Avatar name={group?.name || user.name} size={80} />
            <h3 className="text-xl font-semibold">{group?.name || user.name}</h3>
            <p className="text-sm text-slate-400">
              {group ? `${group.members.length} members` : user.phone}
            </p>
            <p className="text-sm text-center text-slate-300">
              {group?.description || user.about || 'Available'}
            </p>
            {user.isFounder && <span className="text-xs text-brand-400">Site founder</span>}
          </div>
          {group ? (
            <>
              {group.admins.includes(me.phone) && (
                <form
                  className="space-y-3 border-t border-white/10 pt-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    run(
                      () =>
                        request('update_group', {
                          id: group.id,
                          action: 'details',
                          name,
                          description: about,
                        }),
                      false
                    );
                  }}
                >
                  <label className="field-label">
                    Group name
                    <input
                      className="field"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      minLength={2}
                      maxLength={60}
                      required
                    />
                  </label>
                  <label className="field-label">
                    Description
                    <input
                      className="field"
                      value={about}
                      onChange={(e) => setAbout(e.target.value)}
                      maxLength={240}
                    />
                  </label>
                  {primary('Update group')}
                </form>
              )}
              <p className="text-xs uppercase tracking-wider text-slate-400">Members</p>
              {group.members.map((p) => (
                <div className="flex items-center gap-2" key={p}>
                  <Avatar name={person(p).name} size={34} />
                  <div className="min-w-0 flex-1 text-sm truncate">
                    {p === me.phone ? 'You' : person(p).name}
                    {group.tags?.[p] && (
                      <small className="block text-[10px] text-slate-400">{group.tags[p]}</small>
                    )}
                    {group.admins.includes(p) && (
                      <span className="ml-2 text-[10px] text-brand-400">Admin</span>
                    )}
                  </div>
                  {group.admins.includes(me.phone) && p !== me.phone && (
                    <>
                      {!group.admins.includes(p) && (
                        <button
                          className="text-[11px] text-brand-400"
                          disabled={busy}
                          onClick={() =>
                            run(
                              () =>
                                request('update_group', {
                                  id: group.id,
                                  action: 'admin',
                                  phone: p,
                                }),
                              false
                            )
                          }
                        >
                          Make admin
                        </button>
                      )}
                      <button
                        aria-label={`Remove ${person(p).name}`}
                        className="p-2 text-red-400"
                        disabled={busy}
                        onClick={() =>
                          run(
                            () =>
                              request('update_group', { id: group.id, action: 'remove', phone: p }),
                            false
                          )
                        }
                      >
                        <Trash2 size={15} />
                      </button>
                    </>
                  )}
                </div>
              ))}
              {group.admins.includes(me.phone) && (
                <div className="flex gap-2">
                  <select
                    className="field min-w-0"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  >
                    <option value="">Add a member…</option>
                    {contacts
                      .filter((u) => !group.members.includes(u.phone))
                      .map((u) => (
                        <option key={u.phone} value={u.phone}>
                          {u.name}
                        </option>
                      ))}
                  </select>
                  <button
                    disabled={!query || busy}
                    className="btn-secondary"
                    aria-label="Add member"
                    onClick={() =>
                      run(async () => {
                        await request('update_group', {
                          id: group.id,
                          action: 'add',
                          phone: query,
                        });
                        setQuery('');
                      }, false)
                    }
                  >
                    <Plus size={18} />
                  </button>
                </div>
              )}
              <GroupTools
                group={group}
                me={me.phone}
                request={request}
                onClone={(source) => onFeature('group_create', { source })}
              />
              <button
                className="btn-secondary w-full text-red-400"
                disabled={busy}
                onClick={() =>
                  run(() => request('update_group', { id: group.id, action: 'leave' }))
                }
              >
                Leave group
              </button>
            </>
          ) : (
            <>
              <p className="text-xs text-center text-slate-500">
                {user.online
                  ? 'Online now'
                  : user.lastSeen
                    ? `Last seen ${new Date(user.lastSeen).toLocaleString()}`
                    : 'Offline'}
              </p>
              {user.phone !== me.phone && (
                <div className="flex gap-2">
                  <button
                    className="btn-secondary flex-1"
                    onClick={() => {
                      onClose();
                      onCall('audio', user);
                    }}
                  >
                    <Phone size={16} /> Voice call
                  </button>
                  <button
                    className="btn-secondary flex-1"
                    onClick={() => {
                      onClose();
                      onCall('video', user);
                    }}
                  >
                    <Video size={16} /> Video call
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}
      {dialog.type === 'forward' && (
        <>
          <input
            className="field"
            placeholder="Search chats"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          {[...users, ...groups]
            .filter(
              (u) =>
                u.name?.toLowerCase().includes(query.toLowerCase()) &&
                !preferences.blocked.includes(u.phone)
            )
            .map((u) => (
              <button
                key={u.phone}
                disabled={busy}
                className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-white/5"
                onClick={() => run(() => onForward(u, dialog.messages || [dialog.message]))}
              >
                <Avatar name={u.name} size={36} />
                <span className="text-left flex-1">
                  {u.phone === me.phone ? 'Message yourself' : u.name}
                  {u.isGroup && <small className="block text-slate-500">Group</small>}
                </span>
                <Check size={16} />
              </button>
            ))}
        </>
      )}
      {dialog.type === 'edit' && (
        <form
          className="space-y-4"
          onSubmit={(e) =>
            submit(e, () =>
              request('edit_message', {
                roomId: dialog.message.roomId,
                messageId: dialog.message.id,
                text,
              })
            )
          }
        >
          <textarea
            className="field min-h-32"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={4000}
            required
            autoFocus
          />
          {primary('Save changes')}
        </form>
      )}
      {dialog.type === 'timer' && (
        <>
          <p className="text-sm text-slate-400">
            New {user.isGroup ? 'group messages' : 'messages you send'} will automatically disappear
            after this period. Existing messages keep their original timer.
          </p>
          {[
            [0, 'Off'],
            [86400000, '24 hours'],
            [604800000, '7 days'],
            [7776000000, '90 days'],
          ].map(([duration, label]) => (
            <button
              key={duration}
              className="btn-secondary w-full justify-between"
              disabled={busy}
              onClick={() => run(() => request('disappearing', { to: user.phone, duration }))}
            >
              {label}
              {(user.isGroup
                ? group?.disappearing || 0
                : preferences.disappearing?.[user.phone] || 0) === duration && <Check size={16} />}
            </button>
          ))}
        </>
      )}
      {dialog.type === 'calls' && (
        <>
          {!calls.length && (
            <p className="text-sm text-slate-400">Your voice and video calls will appear here.</p>
          )}
          {calls.map((c) => {
            const p = person(c.from === me.phone ? c.to : c.from);
            return (
              <button
                key={c.callId}
                className="w-full flex items-center gap-3 p-3 hover:bg-white/5 rounded-xl"
                onClick={() => {
                  onClose();
                  onCall(c.type, p);
                }}
              >
                <Avatar name={p.name} size={40} />
                <span className="text-left min-w-0 flex-1">
                  <span className="block truncate">{p.name}</span>
                  <small
                    className={`block ${['missed', 'declined', 'interrupted'].includes(c.status) ? 'text-red-400' : 'text-slate-400'}`}
                  >
                    {c.from === me.phone ? 'Outgoing' : 'Incoming'} · {c.status}
                    {c.duration ? ` · ${Math.floor(c.duration / 60)}m ${c.duration % 60}s` : ''}
                  </small>
                  <small className="text-slate-500">{new Date(c.time).toLocaleString()}</small>
                </span>
                {c.type === 'video' ? <Video size={18} /> : <Phone size={18} />}
              </button>
            );
          })}
        </>
      )}
      {dialog.type === 'statuses' && (
        <>
          <form
            className="space-y-3"
            onSubmit={(e) =>
              submit(e, async () => {
                await request('post_status', { text, color });
                setText('');
              })
            }
          >
            <label className="field-label">
              Share an update · disappears in 24 hours
              <textarea
                className="field min-h-24"
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={700}
                required
                placeholder="What's on your mind?"
              />
            </label>
            <div className="flex gap-2">
              {['#047857', '#4338ca', '#9d174d', '#92400e'].map((c) => (
                <button
                  type="button"
                  key={c}
                  aria-label={`Status color ${c}`}
                  aria-pressed={color === c}
                  className={`w-8 h-8 rounded-full border-2 ${color === c ? 'border-white' : 'border-transparent'}`}
                  style={{ background: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
            {primary('Share status')}
          </form>
          {viewing && statuses.some((s) => s.id === viewing.id) && (
            <div className="rounded-xl p-6 space-y-4" style={{ background: viewing.color }}>
              <p className="text-sm font-semibold">{viewing.fromName}</p>
              <p className="text-xl whitespace-pre-wrap break-words">{viewing.text}</p>
              <button className="text-xs underline" onClick={() => setViewing(null)}>
                Close update
              </button>
            </div>
          )}
          {!statuses.length && (
            <p className="text-sm text-slate-400">No updates yet. Share the first one.</p>
          )}
          {statuses.map((s) => (
            <div key={s.id} className="flex items-center gap-3 p-2 hover:bg-white/5 rounded-xl">
              <button
                className="flex items-center gap-3 min-w-0 flex-1 text-left"
                onClick={() => {
                  setViewing(s);
                  request('view_status', { id: s.id }, false);
                }}
              >
                <Avatar name={s.fromName} size={42} ring />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">
                    {s.from === me.phone ? 'My status' : s.fromName}
                  </span>
                  <small className="block truncate text-slate-400">{s.text}</small>
                  <small className="text-slate-500">{formatTime(s.time)}</small>
                </span>
              </button>
              {s.from === me.phone && (
                <>
                  <span
                    title={s.viewedBy.map((p) => person(p).name).join(', ')}
                    className="flex items-center gap-1 text-xs text-slate-400"
                  >
                    <Eye size={14} />
                    {s.viewedBy.length}
                  </span>
                  <button
                    className="p-2 text-red-400"
                    aria-label="Delete status"
                    disabled={busy}
                    onClick={() => run(() => request('delete_status', { id: s.id }), false)}
                  >
                    <Trash2 size={16} />
                  </button>
                </>
              )}
            </div>
          ))}
        </>
      )}
      {['starred', 'media'].includes(dialog.type) && (
        <>
          {messages.filter(
            (m) =>
              !m.deleted &&
              (dialog.type === 'starred'
                ? preferences.starred.includes(m.id)
                : m.file || m.voice || m.gif)
          ).length === 0 && (
            <p className="text-sm text-slate-400">
              {dialog.type === 'starred'
                ? 'Star a message from its menu to find it here.'
                : 'Photos, videos, voice notes and files shared in this chat appear here.'}
            </p>
          )}
          {messages
            .filter(
              (m) =>
                !m.deleted &&
                (dialog.type === 'starred'
                  ? preferences.starred.includes(m.id)
                  : m.file || m.voice || m.gif)
            )
            .map((m) => (
              <div key={m.id} className="p-3 bg-white/5 rounded-xl space-y-2">
                <p className="text-xs text-brand-400">
                  {m.fromName} · {formatTime(m.time)}
                </p>
                {m.file?.mime?.startsWith('image/') && (
                  <img className="max-h-40 rounded-lg" src={m.file.url} alt={m.file.name} />
                )}
                {m.text && <p className="text-sm whitespace-pre-wrap break-words">{m.text}</p>}
                {(m.file || m.voice || m.gif) && (
                  <a
                    className="text-xs text-brand-400 underline block"
                    href={(m.file || m.voice || m.gif).url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {shortPreview(m) || 'Open attachment'}
                  </a>
                )}
              </div>
            ))}
        </>
      )}
    </Modal>
  );
}
