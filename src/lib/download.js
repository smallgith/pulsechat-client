export function downloadText(filename, text, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function downloadCalendar(event) {
  const escape = (v) =>
    String(v || '')
      .replace(/\\/g, '\\\\')
      .replace(/\n/g, '\\n')
      .replace(/,/g, '\\,')
      .replace(/;/g, '\\;')
      .replace(/\r/g, '');
  const date = (v) =>
    new Date(v)
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}/, '');
  downloadText(
    'PulseChat-event.ics',
    [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//PulseChat//Workspace//EN',
      'BEGIN:VEVENT',
      `UID:${event.at}-${encodeURIComponent(event.title)}@pulsechat`,
      `DTSTAMP:${date(Date.now())}`,
      `DTSTART:${date(event.at)}`,
      `DTEND:${date(event.at + 3600000)}`,
      `SUMMARY:${escape(event.title)}`,
      `LOCATION:${escape(event.location)}`,
      `DESCRIPTION:${escape(event.description)}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n'),
    'text/calendar;charset=utf-8'
  );
}
