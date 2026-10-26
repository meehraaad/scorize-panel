/** An event for the person's own calendar app (.ics), made in the browser: no request. */
export interface CalendarEvent {
  /** Stable, so adding it twice updates one event. */
  uid: string;
  title: string;
  starts_at: string;
  minutes: number;
  description?: string;
}

/** 2026-10-28T06:30:00.000Z → 20261028T063000Z */
const stamp = (date: Date) =>
  date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');

/** Commas, semicolons, backslashes and line breaks are escaped in iCalendar text. */
const text = (value: string) =>
  value.replace(/[\\;,]/g, (character) => `\\${character}`).replace(/\r?\n/g, '\\n');

export function icsOf(event: CalendarEvent, now = new Date()): string {
  const start = new Date(event.starts_at);
  const end = new Date(start.getTime() + event.minutes * 60_000);
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Scorize//Panel//FA',
    'BEGIN:VEVENT',
    `UID:${event.uid}`,
    `DTSTAMP:${stamp(now)}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${text(event.title)}`,
    ...(event.description ? [`DESCRIPTION:${text(event.description)}`] : []),
    // A reminder an hour before, besides the SMS the day before.
    'BEGIN:VALARM',
    'TRIGGER:-PT1H',
    'ACTION:DISPLAY',
    `DESCRIPTION:${text(event.title)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n');
}

/** Saves the event as a file; phones and desktops open it in their calendar. */
export function downloadIcs(event: CalendarEvent, filename: string) {
  const url = URL.createObjectURL(
    new Blob([icsOf(event)], { type: 'text/calendar;charset=utf-8' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
