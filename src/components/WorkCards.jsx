import { useState } from 'react';
import {
  BarChart3,
  CalendarDays,
  Check,
  CheckCircle2,
  Download,
  ListTodo,
  Lightbulb,
  UserRound,
} from 'lucide-react';
import { downloadCalendar, downloadText } from '../lib/download';

export default function WorkCards({ message: m, me, onAction, onOpenContact }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const act = async (action, data = {}) => {
    setBusy(true);
    setError('');
    try {
      await onAction(m, action, data);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      {m.poll && (
        <div className="work-card">
          <p className="card-eyebrow">
            <BarChart3 size={14} /> LIVE POLL {m.poll.closed && '· CLOSED'}
          </p>
          <h4>{m.poll.question}</h4>
          <p className="card-hint">
            {m.poll.multiple ? 'Choose one or more' : 'Choose one option'}
          </p>
          {m.poll.options.map((o) => {
            const votes = new Set(m.poll.options.flatMap((o) => o.voters)).size;
            return (
              <button
                key={o.id}
                disabled={busy || m.poll.closed}
                aria-pressed={o.voters.includes(me)}
                className={`poll-option ${o.voters.includes(me) ? 'is-voted' : ''}`}
                onClick={() => act('vote', { optionId: o.id })}
              >
                <span
                  className="poll-fill"
                  style={{ width: `${votes ? (o.voters.length / votes) * 100 : 0}%` }}
                />
                <span>
                  {o.voters.includes(me) && <Check size={13} />}
                  {o.text}
                </span>
                <small>{o.voters.length}</small>
              </button>
            );
          })}
          <div className="flex justify-between items-center gap-3 card-hint">
            <span>{new Set(m.poll.options.flatMap((o) => o.voters)).size} voters</span>
            {m.from === me && !m.poll.closed && (
              <button disabled={busy} onClick={() => act('close_poll')}>
                Close poll
              </button>
            )}
          </div>
        </div>
      )}
      {m.event && (
        <div className="work-card">
          <p className="card-eyebrow">
            <CalendarDays size={14} /> EVENT
          </p>
          <h4>{m.event.title}</h4>
          <p className="text-sm font-medium">
            {new Date(m.event.at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
          </p>
          {m.event.location && <p className="card-hint">{m.event.location}</p>}
          {m.event.description && (
            <p className="text-sm whitespace-pre-wrap">{m.event.description}</p>
          )}
          <div className="flex flex-wrap gap-1.5 mt-3">
            {[
              ['going', 'Going'],
              ['maybe', 'Maybe'],
              ['declined', 'Can’t go'],
            ].map(([key, label]) => (
              <button
                key={key}
                disabled={busy}
                aria-pressed={m.event.responses[me] === key}
                className={`card-chip ${m.event.responses[me] === key ? 'active' : ''}`}
                onClick={() => act('rsvp', { response: key })}
              >
                {label} · {Object.values(m.event.responses).filter((v) => v === key).length}
              </button>
            ))}
          </div>
          <button className="card-link mt-3" onClick={() => downloadCalendar(m.event)}>
            <Download size={13} /> Add to calendar
          </button>
        </div>
      )}
      {m.task && (
        <div className="work-card">
          <p className="card-eyebrow">
            <ListTodo size={14} /> SHARED TASK{' '}
            <span className={`priority ${m.task.priority}`}>{m.task.priority}</span>
          </p>
          <h4 className={m.task.state === 'done' ? 'line-through opacity-60' : ''}>
            {m.task.title}
          </h4>
          {m.task.description && (
            <p className="card-hint whitespace-pre-wrap">{m.task.description}</p>
          )}
          <div className="flex flex-wrap items-center gap-2 card-hint mt-2">
            <span>
              {m.task.assignee
                ? m.task.assignee === me
                  ? 'Assigned to you'
                  : `Assigned · ${m.task.assigneeName || m.task.assignee}`
                : 'Unassigned'}
            </span>
            {m.task.dueAt && (
              <span
                className={
                  m.task.dueAt < Date.now() && m.task.state !== 'done' ? 'text-red-400' : ''
                }
              >
                Due {new Date(m.task.dueAt).toLocaleDateString()}
              </span>
            )}
          </div>
          <label className="flex items-center gap-2 mt-3 text-xs">
            <CheckCircle2 size={15} />
            <select
              aria-label={`Task status: ${m.task.title}`}
              className="card-select"
              value={m.task.state}
              disabled={busy}
              onChange={(e) => act('task_state', { state: e.target.value })}
            >
              <option value="todo">To do</option>
              <option value="doing">In progress</option>
              <option value="done">Done</option>
            </select>
          </label>
        </div>
      )}
      {m.decision && (
        <div className="work-card">
          <p className="card-eyebrow">
            <Lightbulb size={14} /> DECISION LOG
          </p>
          <h4>{m.decision.title}</h4>
          {m.decision.context && (
            <p className="card-hint whitespace-pre-wrap">{m.decision.context}</p>
          )}
          <button
            className={`card-chip mt-3 ${m.decision.agreedBy.includes(me) ? 'active' : ''}`}
            disabled={busy}
            aria-pressed={m.decision.agreedBy.includes(me)}
            onClick={() => act('agree')}
          >
            <Check size={13} /> Acknowledged · {m.decision.agreedBy.length}
          </button>
        </div>
      )}
      {m.contact && (
        <div className="work-card">
          <p className="card-eyebrow">
            <UserRound size={14} /> CONTACT
          </p>
          <h4>{m.contact.name}</h4>
          <p className="card-hint">{m.contact.phone}</p>
          <div className="flex gap-3 mt-3">
            <button className="card-link" onClick={() => onOpenContact?.(m.contact)}>
              Open chat
            </button>
            <button
              className="card-link"
              onClick={() =>
                downloadText(
                  `${m.contact.name.replace(/[^\w -]/g, '')}.vcf`,
                  `BEGIN:VCARD\r\nVERSION:3.0\r\nFN:${m.contact.name.replace(/[\r\n;\\]/g, '')}\r\nTEL:${m.contact.phone.replace(/[^+\d]/g, '')}\r\nEND:VCARD`,
                  'text/vcard'
                )
              }
            >
              Save contact
            </button>
          </div>
        </div>
      )}
      {m.sticker && (
        <div className={`custom-sticker ${m.sticker.color}`}>
          <span>{m.sticker.emoji}</span>
          {m.sticker.label && <strong>{m.sticker.label}</strong>}
        </div>
      )}
      {error && (
        <p role="alert" className="text-xs text-red-400 p-2">
          {error}
        </p>
      )}
    </>
  );
}
