import { describe, expect, it } from 'vitest';
import { icsOf } from './ics';

describe('icsOf', () => {
  it('writes the session as one event in UTC', () => {
    const ics = icsOf(
      {
        uid: 'consultation-7@scorize',
        title: 'مشاوره; اپلای, ارشد',
        starts_at: '2026-10-28T10:00:00+03:30',
        minutes: 45,
      },
      new Date('2026-10-26T00:00:00Z'),
    );
    expect(ics).toContain('DTSTART:20261028T063000Z');
    expect(ics).toContain('DTEND:20261028T071500Z');
    expect(ics).toContain('SUMMARY:مشاوره\\; اپلای\\, ارشد');
    expect(ics.split('\r\n')[0]).toBe('BEGIN:VCALENDAR');
  });
});
