import type { TicketMessage } from './api';

export type ThreadItem =
  | { kind: 'day'; key: string; date: string }
  | { kind: 'message'; key: string; message: TicketMessage };

/** Local calendar day of a moment ("2026-10-23"), so separators follow the viewer's clock. */
export function dayOf(value: string | Date) {
  const date = new Date(value);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${String(date.getFullYear())}-${month}-${day}`;
}

/** Messages (oldest first) with a day separator before the first message of each day. */
export function withDays(messages: readonly TicketMessage[]): ThreadItem[] {
  const items: ThreadItem[] = [];
  let last = '';
  for (const message of messages) {
    const day = dayOf(message.sent_at);
    if (day !== last) items.push({ kind: 'day', key: `day-${day}`, date: message.sent_at });
    last = day;
    items.push({ kind: 'message', key: String(message.id), message });
  }
  return items;
}

/** 0 today, 1 yesterday, … (whole calendar days, not 24-hour spans). */
export function daysAgo(value: string, now = new Date()) {
  const start = (date: Date) =>
    new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  return Math.round((start(now) - start(new Date(value))) / 86_400_000);
}
