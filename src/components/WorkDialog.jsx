import { useState } from 'react';
import {
  CalendarDays,
  Clock3,
  ListTodo,
  Lightbulb,
  Search,
  ArrowUpRight,
  Plus,
  Check,
  Trash2,
  BarChart3,
  Layers,
  Zap,
} from 'lucide-react';
import Modal from './Modal';
import Avatar from './Avatar';
import WorkCards from './WorkCards';
import { shortPreview } from '../lib/format';
import { roomId } from '../lib/socket';

export const workDialogTypes = [
  'poll',
  'event',
  'task',
  'decision',
  'contact_share',
  'sticker',
  'schedule',
  'scheduled',
  'board',
  'lists',
  'invite',
  'theme',
  'command',
  'report',
  'reports',
];
export default function WorkDialog({
  dialog,
  onClose,
  me,
  chats,
  users,
  messages,
  scheduled,
  reports,
  request,
  sendTo,
  onSelect,
  preferences,
  onAction,
  theme,
  setTheme,
  onFeature,
  onScheduled,
}) {
  const [mode, setMode] = useState(dialog.type),
    [tab, setTab] = useState('tasks'),
    [query, setQuery] = useState('');
  const [target, setTarget] = useState(dialog.user?.phone || me.phone);
  const [title, setTitle] = useState(dialog.message?.text || dialog.initialText || ''),
    [description, setDescription] = useState('');
  const [options, setOptions] = useState(['', '', '']),
    [multiple, setMultiple] = useState(false);
  const [date, setDate] = useState(''),
    [location, setLocation] = useState(''),
    [assignee, setAssignee] = useState(''),
    [priority, setPriority] = useState('normal');
  const [phone, setPhone] = useState(''),
    [emoji, setEmoji] = useState('✨'),
    [color, setColor] = useState('violet');
  const [token, setToken] = useState(
      new URLSearchParams(window.location.search).get('invite') || ''
    ),
    [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [scope, setScope] = useState(
      dialog.type === 'board' && dialog.user ? dialog.user.phone : 'all'
    );
  const titles = {
    poll: 'Let’s make a decision',
    event: 'Bring everyone together',
    task: 'Turn a thought into action',
    decision: 'Make it official',
    contact_share: 'Share a contact',
    sticker: 'Make a little statement',
    schedule: 'Send at the right time',
    scheduled: 'Your outbox',
    board: 'Your work, in one place',
    lists: 'Organise your conversations',
    invite: 'Join a group',
    theme: 'Make yourself at home',
    command: 'Find anything',
    report: 'Report this conversation',
    reports: 'Reports to review',
  };
  const targetChat = chats.find((c) => c.phone === target);
  const members = targetChat?.isGroup ? targetChat.members : [me.phone, target];
  const run = async (fn, close = true) => {
    setBusy(true);
    setError('');
    try {
      await fn();
      if (close) onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const submit = async (e) => {
    e.preventDefault();
    run(async () => {
      if (mode === 'schedule') {
        await request('schedule_message', {
          to: target,
          text: title,
          at: new Date(date).toISOString(),
        });
        onScheduled?.(target, title);
        return;
      }
      if (mode === 'report') {
        await request('report_chat', { to: target, reason: description });
        return;
      }
      const payload =
        mode === 'poll'
          ? { poll: { question: title, options, multiple } }
          : mode === 'event'
            ? { event: { title, at: new Date(date).toISOString(), location, description } }
            : mode === 'task'
              ? {
                  task: {
                    title,
                    description,
                    assignee,
                    priority,
                    dueAt: date ? new Date(date).toISOString() : null,
                    sourceId: dialog.message?.id,
                  },
                }
              : mode === 'decision'
                ? { decision: { title, context: description } }
                : mode === 'contact_share'
                  ? { contact: { name: title, phone } }
                  : { sticker: { emoji, label: title, color } };
      await sendTo(target, payload);
    });
  };
  const pickChat = (
    <label className="field-label">
      Conversation
      <select
        aria-label="Conversation"
        className="field"
        value={target}
        onChange={(e) => setTarget(e.target.value)}
      >
        {chats.map((u) => (
          <option key={u.phone} value={u.phone}>
            {u.name}
          </option>
        ))}
      </select>
    </label>
  );
  const field = (label, value, onChange, props = {}) => (
    <label className="field-label">
      {label}
      <input
        className="field"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        {...props}
      />
    </label>
  );
  const eligible = messages.filter(
    (m) =>
      !m.deleted &&
      !m.deletedFor?.includes(me.phone) &&
      (scope === 'all' || m.roomId === roomId(me.phone, scope))
  );
  return (
    <Modal
      title={titles[mode] || 'Workspace'}
      onClose={onClose}
      wide={['board', 'command'].includes(mode)}
    >
      {error && (
        <p role="alert" className="error-banner">
          {error}
        </p>
      )}
      {[
        'poll',
        'event',
        'task',
        'decision',
        'contact_share',
        'sticker',
        'schedule',
        'report',
      ].includes(mode) && (
        <form onSubmit={submit} className="space-y-4">
          {pickChat}
          {mode !== 'report' &&
            mode !== 'sticker' &&
            field(
              mode === 'poll'
                ? 'Question'
                : mode === 'contact_share'
                  ? 'Contact name'
                  : mode === 'schedule'
                    ? 'Message'
                    : 'Title',
              title,
              setTitle,
              { required: true, maxLength: mode === 'schedule' ? 4000 : 250, autoFocus: true }
            )}
          {mode === 'poll' && (
            <>
              <p className="text-xs text-slate-400">Options · at least two different answers</p>
              {options.map((v, i) => (
                <div className="flex gap-2" key={i}>
                  <input
                    className="field"
                    aria-label={`Option ${i + 1}`}
                    value={v}
                    onChange={(e) =>
                      setOptions(options.map((o, j) => (j === i ? e.target.value : o)))
                    }
                    required={i < 2}
                    maxLength={100}
                    placeholder={`Option ${i + 1}`}
                  />
                  {i > 1 && (
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label={`Remove option ${i + 1}`}
                      onClick={() => setOptions(options.filter((_, j) => j !== i))}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                disabled={options.length >= 10}
                className="btn-secondary"
                onClick={() => setOptions([...options, ''])}
              >
                <Plus size={16} />
                Add option
              </button>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={multiple}
                  onChange={(e) => setMultiple(e.target.checked)}
                />
                Allow multiple answers
              </label>
            </>
          )}
          {['event', 'schedule', 'task'].includes(mode) &&
            field(
              mode === 'task'
                ? 'Due date (optional)'
                : mode === 'schedule'
                  ? 'Send at · your local time'
                  : 'Date & time · your local time',
              date,
              setDate,
              { type: 'datetime-local', required: mode !== 'task' }
            )}
          {mode === 'event' &&
            field('Location or meeting link', location, setLocation, { maxLength: 200 })}
          {mode === 'task' && (
            <div className="grid grid-cols-2 gap-3">
              <label className="field-label">
                Assign to
                <select
                  aria-label="Assign to"
                  className="field"
                  value={assignee}
                  onChange={(e) => setAssignee(e.target.value)}
                >
                  <option value="">Anyone</option>
                  {users
                    .filter((u) => members.includes(u.phone))
                    .map((u) => (
                      <option key={u.phone} value={u.phone}>
                        {u.phone === me.phone ? 'You' : u.name}
                      </option>
                    ))}
                </select>
              </label>
              <label className="field-label">
                Priority
                <select
                  aria-label="Priority"
                  className="field"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                </select>
              </label>
            </div>
          )}
          {['task', 'event', 'decision', 'report'].includes(mode) && (
            <label className="field-label">
              {mode === 'report'
                ? 'Describe the issue'
                : mode === 'decision'
                  ? 'Why this decision?'
                  : 'Details (optional)'}
              <textarea
                className="field min-h-24"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={1000}
                minLength={mode === 'report' ? 5 : undefined}
                required={mode === 'report'}
              />
            </label>
          )}
          {mode === 'schedule' && (
            <p className="text-xs text-slate-400">
              Sent by the server, even when you are offline. You can cancel it from your outbox
              before it sends.
            </p>
          )}
          {mode === 'contact_share' && (
            <>
              {field('Phone number', phone, setPhone, {
                required: true,
                type: 'tel',
                maxLength: 20,
              })}
              <p className="text-xs text-slate-400">Or choose someone you know</p>
              {users
                .filter((u) => u.phone !== me.phone)
                .map((u) => (
                  <button
                    key={u.phone}
                    type="button"
                    className="contact-choice"
                    onClick={() => {
                      setTitle(u.name);
                      setPhone(u.phone);
                    }}
                  >
                    <Avatar name={u.name} size={32} />
                    <span>{u.name}</span>
                    <small>{u.phone}</small>
                  </button>
                ))}
            </>
          )}
          {mode === 'sticker' && (
            <>
              <div className={`custom-sticker preview ${color}`}>
                <span>{emoji}</span>
                <strong>{title || 'Your energy, your way'}</strong>
              </div>
              <div className="grid grid-cols-6 gap-2">
                {['✨', '🚀', '✅', '🎉', '💡', '🔥', '💜', '👍', '☕', '🙌', '🫡', '💯'].map(
                  (e) => (
                    <button
                      key={e}
                      type="button"
                      className={`text-2xl p-2 rounded-xl ${emoji === e ? 'bg-brand-500/20' : 'bg-white/5'}`}
                      onClick={() => setEmoji(e)}
                    >
                      {e}
                    </button>
                  )
                )}
              </div>
              {field('Your caption', title, setTitle, { maxLength: 30 })}
              <div className="flex gap-2">
                {['violet', 'coral', 'mint', 'amber'].map((c) => (
                  <button
                    aria-label={`Sticker colour ${c}`}
                    aria-pressed={color === c}
                    key={c}
                    type="button"
                    className={`color-swatch ${c}`}
                    onClick={() => setColor(c)}
                  >
                    {c === color && <Check size={14} />}
                  </button>
                ))}
              </div>
            </>
          )}
          <button disabled={busy} className="btn-primary w-full">
            {busy
              ? 'Saving…'
              : mode === 'schedule'
                ? 'Schedule message'
                : mode === 'task'
                  ? 'Create task'
                  : mode === 'decision'
                    ? 'Record decision'
                    : mode === 'poll'
                      ? 'Create poll'
                      : mode === 'event'
                        ? 'Create event'
                        : mode === 'report'
                          ? 'Submit report'
                          : 'Share in chat'}
          </button>
        </form>
      )}
      {mode === 'board' && (
        <>
          <div className="board-intro">
            <span className="eyebrow">LESS SCROLLING. MORE DOING.</span>
            <h3>A conversation can move work forward.</h3>
            <p>Tasks, decisions and plans stay connected to the people who made them.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="btn-primary"
              onClick={() => {
                setMode('task');
                setTitle('');
              }}
            >
              <Plus size={16} />
              New task
            </button>
            <button
              className="btn-secondary"
              onClick={() => {
                setMode('decision');
                setTitle('');
              }}
            >
              <Lightbulb size={16} />
              Record decision
            </button>
            <select
              aria-label="Workspace chat filter"
              className="field !w-auto flex-1"
              value={scope}
              onChange={(e) => setScope(e.target.value)}
            >
              <option value="all">Across all conversations</option>
              {chats.map((c) => (
                <option value={c.phone} key={c.phone}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="tab-strip">
            {[
              ['tasks', 'Tasks', ListTodo],
              ['decisions', 'Decisions', Lightbulb],
              ['events', 'Events', CalendarDays],
              ['polls', 'Polls', BarChart3],
              ['catchup', 'Catch up', Zap],
            ].map(([key, label, Icon]) => (
              <button className={tab === key ? 'active' : ''} key={key} onClick={() => setTab(key)}>
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>
          {tab === 'tasks' ? (
            <div className="kanban">
              {[
                ['todo', 'To do'],
                ['doing', 'In progress'],
                ['done', 'Done'],
              ].map(([state, label]) => (
                <section key={state}>
                  <h4>
                    {label}
                    <span>{eligible.filter((m) => m.task?.state === state).length}</span>
                  </h4>
                  {eligible
                    .filter((m) => m.task?.state === state)
                    .map((m) => (
                      <div key={m.id} className="board-item">
                        <WorkCards message={m} me={me.phone} onAction={onAction} />
                        <button
                          className="card-link"
                          onClick={() =>
                            onSelect(
                              chats.find((c) => roomId(me.phone, c.phone) === m.roomId),
                              m.id
                            )
                          }
                        >
                          Open conversation <ArrowUpRight size={12} />
                        </button>
                      </div>
                    ))}
                </section>
              ))}
            </div>
          ) : tab === 'catchup' ? (
            <div className="space-y-3">
              <p className="text-xs text-slate-400">
                Unread messages across your conversations, ready when you are.
              </p>
              {eligible
                .filter((m) => m.from !== me.phone && !m.readBy?.includes(me.phone))
                .slice(-50)
                .reverse()
                .map((m) => (
                  <button
                    key={m.id}
                    className="search-result"
                    onClick={() =>
                      onSelect(
                        chats.find((c) => roomId(me.phone, c.phone) === m.roomId),
                        m.id
                      )
                    }
                  >
                    <span>
                      {m.fromName}
                      <small>{shortPreview(m)}</small>
                    </span>
                    <ArrowUpRight size={15} />
                  </button>
                ))}
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {eligible
                .filter((m) =>
                  tab === 'decisions' ? m.decision : tab === 'events' ? m.event : m.poll
                )
                .reverse()
                .map((m) => (
                  <div key={m.id} className="board-item">
                    <WorkCards message={m} me={me.phone} onAction={onAction} />
                    <button
                      className="card-link"
                      onClick={() =>
                        onSelect(
                          chats.find((c) => roomId(me.phone, c.phone) === m.roomId),
                          m.id
                        )
                      }
                    >
                      Open conversation <ArrowUpRight size={12} />
                    </button>
                  </div>
                ))}
            </div>
          )}
        </>
      )}
      {mode === 'scheduled' && (
        <>
          <p className="text-sm text-slate-400">
            Messages that work around your day. Pending messages survive browser and server
            restarts.
          </p>
          {scheduled.length === 0 && (
            <p className="empty-hint">
              Your outbox is clear. Use the clock in the composer to schedule a message.
            </p>
          )}
          {scheduled.map((s) => (
            <div className="board-item space-y-2" key={s.id}>
              <p className="text-xs font-semibold text-brand-400">
                {chats.find((c) => c.phone === s.to)?.name || s.to} · {s.state}
              </p>
              <p className="text-sm whitespace-pre-wrap">{s.text}</p>
              <div className="flex justify-between gap-3 text-xs text-slate-400">
                <span>{new Date(s.at).toLocaleString()}</span>
                {s.state === 'pending' && (
                  <button
                    disabled={busy}
                    className="text-red-400"
                    onClick={() => run(() => request('cancel_scheduled', { id: s.id }), false)}
                  >
                    Cancel delivery
                  </button>
                )}
              </div>
              {s.error && <p className="text-xs text-red-400">{s.error}</p>}
            </div>
          ))}
        </>
      )}
      {mode === 'lists' && (
        <>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              run(async () => {
                await request('chat_list', {
                  action: 'create',
                  name: title,
                  chat: dialog.user?.phone,
                });
                setTitle('');
              }, false);
            }}
          >
            <input
              className="field"
              aria-label="List name"
              placeholder="e.g. Design team"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={40}
              required
            />
            <button disabled={busy} className="btn-primary">
              Create list
            </button>
          </form>
          {(preferences.lists || []).map((l) => (
            <div key={l.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/5">
              <Layers size={18} />
              <span className="flex-1 text-sm">
                {l.name}
                <small className="block text-slate-400">{l.chats.length} conversations</small>
              </span>
              {dialog.user && (
                <button
                  className="btn-secondary !py-1.5"
                  disabled={busy}
                  onClick={() =>
                    run(
                      () =>
                        request('chat_list', {
                          action: 'toggle',
                          id: l.id,
                          chat: dialog.user.phone,
                        }),
                      false
                    )
                  }
                >
                  {l.chats.includes(dialog.user.phone) ? 'Remove chat' : 'Add chat'}
                </button>
              )}
              <button
                className="icon-btn text-red-400"
                aria-label={`Delete list ${l.name}`}
                disabled={busy}
                onClick={() =>
                  run(() => request('chat_list', { action: 'delete', id: l.id }), false)
                }
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </>
      )}
      {mode === 'invite' && (
        <>
          <p className="text-sm text-slate-400">
            Paste an invite link or invite code to preview a group before joining.
          </p>
          <input
            className="field"
            placeholder="Paste group invite link"
            value={token}
            onChange={(e) => {
              const value = e.target.value;
              try {
                setToken(new URL(value).searchParams.get('invite') || value);
              } catch {
                setToken(value);
              }
              setPreview(null);
            }}
          />
          <button
            className="btn-primary w-full"
            disabled={busy || !token}
            onClick={() =>
              run(async () => setPreview((await request('preview_invite', { token })).group), false)
            }
          >
            Preview group
          </button>
          {preview && (
            <div className="board-item text-center space-y-3">
              <h3 className="font-semibold">{preview.name}</h3>
              <p className="text-sm text-slate-400">
                {preview.count} members · {preview.description}
              </p>
              <button
                className="btn-primary w-full"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    const res = await request('join_group', { token });
                    await onSelect(res.group);
                    const url = new URL(location.href);
                    url.searchParams.delete('invite');
                    history.replaceState({}, '', url);
                  })
                }
              >
                {preview.joined ? 'Open group' : 'Join group'}
              </button>
            </div>
          )}
        </>
      )}
      {mode === 'theme' && (
        <>
          <p className="text-sm text-slate-400">
            A little more you. Your choice is saved on this device.
          </p>
          {[
            ['daylight', 'Daylight', 'Warm paper, ink and violet'],
            ['midnight', 'Midnight', 'Quiet charcoal, soft lilac'],
            ['sage', 'Botanical', 'Fresh sage, forest and cream'],
          ].map(([key, name, description]) => (
            <button
              key={key}
              className={`theme-choice ${theme === key ? 'selected' : ''}`}
              onClick={() => setTheme(key)}
            >
              <span className={`theme-preview ${key}`} />
              <span className="flex-1 text-left">
                <strong>{name}</strong>
                <small>{description}</small>
              </span>
              {theme === key && <Check size={18} />}
            </button>
          ))}
        </>
      )}
      {mode === 'command' && (
        <>
          <div className="relative">
            <Search className="absolute left-3 top-3 text-slate-400" size={18} />
            <input
              className="field !pl-10"
              placeholder="Search conversations, messages or actions…"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <p className="eyebrow">QUICK ACTIONS</p>
          <div className="flex flex-wrap gap-2">
            {[
              ['board', 'Workspace'],
              ['scheduled', 'Outbox'],
              ['group_create', 'New group'],
              ['theme', 'Appearance'],
            ].map(([type, label]) => (
              <button key={type} className="btn-secondary" onClick={() => onFeature(type)}>
                {label}
              </button>
            ))}
          </div>
          <p className="eyebrow">CONVERSATIONS</p>
          {chats
            .filter((c) => `${c.name} ${c.phone}`.toLowerCase().includes(query.toLowerCase()))
            .slice(0, 20)
            .map((c) => (
              <button className="search-result" key={c.phone} onClick={() => onSelect(c)}>
                <Avatar name={c.name} size={32} />
                <span>
                  {c.name}
                  <small>{c.isGroup ? `${c.members.length} members` : c.phone}</small>
                </span>
                <ArrowUpRight size={15} />
              </button>
            ))}
          {query.trim().length > 1 && (
            <>
              <p className="eyebrow">MESSAGES</p>
              {eligible
                .filter((m) =>
                  `${m.text} ${m.task?.title || ''} ${m.poll?.question || ''} ${m.file?.name || ''}`
                    .toLowerCase()
                    .includes(query.toLowerCase())
                )
                .slice(-30)
                .reverse()
                .map((m) => (
                  <button
                    key={m.id}
                    className="search-result"
                    onClick={() =>
                      onSelect(
                        chats.find((c) => roomId(me.phone, c.phone) === m.roomId),
                        m.id
                      )
                    }
                  >
                    <span>
                      {m.fromName}
                      <small>{shortPreview(m)}</small>
                    </span>
                    <ArrowUpRight size={15} />
                  </button>
                ))}
            </>
          )}
        </>
      )}
      {mode === 'reports' && (
        <>
          {reports.length === 0 && <p className="empty-hint">No reports to review.</p>}
          {reports.map((r) => (
            <div key={r.id} className="board-item space-y-2">
              <p className="text-xs text-slate-400">
                {r.from} · {r.chat} · {new Date(r.at).toLocaleString()}
              </p>
              <p className="text-sm whitespace-pre-wrap">{r.reason}</p>
              <button
                className="btn-secondary"
                disabled={busy || r.state === 'reviewed'}
                onClick={() => run(() => request('resolve_report', { id: r.id }), false)}
              >
                {r.state === 'reviewed' ? 'Reviewed' : 'Mark reviewed'}
              </button>
            </div>
          ))}
        </>
      )}
    </Modal>
  );
}
