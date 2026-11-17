import { describe, expect, it } from 'vitest';
import { TIME_ZONE } from './tehranTime';

// The test setup installs Tehran time; the suite runs whatever the machine's zone is.
describe('Tehran local time', () => {
  it('reads an instant with Tehran wall-clock fields', () => {
    const date = new Date('2026-11-17T10:30:00Z');
    expect(date.getHours()).toBe(14);
    expect(date.getMinutes()).toBe(0);
    expect(date.getTimezoneOffset()).toBe(-210);
    expect(date.getDay()).toBe(2);
  });

  it('builds dates from local parts and naive strings as Tehran time', () => {
    expect(new Date(2026, 10, 17, 14, 0).toISOString()).toBe('2026-11-17T10:30:00.000Z');
    expect(new Date('2026-11-17T14:00').toISOString()).toBe('2026-11-17T10:30:00.000Z');
    expect(Date.parse('2026-11-17T14:00:00')).toBe(Date.UTC(2026, 10, 17, 10, 30));
    // Date-only and zoned strings keep their meaning.
    expect(new Date('2026-11-17').toISOString()).toBe('2026-11-17T00:00:00.000Z');
    expect(new Date('2026-11-17T14:00:00+03:30').getHours()).toBe(14);
  });

  it('sets local fields in Tehran time', () => {
    const date = new Date('2026-11-17T22:00:00Z'); // 01:30 on the 18th in Tehran
    expect(date.getDate()).toBe(18);
    date.setHours(0, 0, 0, 0);
    expect(date.toISOString()).toBe('2026-11-17T20:30:00.000Z');
    date.setDate(date.getDate() + 1);
    expect(date.toISOString()).toBe('2026-11-18T20:30:00.000Z');
    date.setHours(16);
    expect(date.getMinutes()).toBe(0);
    expect(date.getHours()).toBe(16);
  });

  it('formats in Tehran time and keeps Date checks working', () => {
    const date = new Date('2026-11-17T10:30:00Z');
    const time = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' });
    expect(time.format(date)).toBe('14:00');
    expect(time.resolvedOptions().timeZone).toBe(TIME_ZONE);
    expect(time).toBeInstanceOf(Intl.DateTimeFormat);
    expect(date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })).toBe('14:00');
    expect(date.toString()).toBe('Tue Nov 17 2026 14:00:00 GMT+0330 (Iran Standard Time)');
    expect(date).toBeInstanceOf(Date);
    expect(typeof Date()).toBe('string');
    expect(Number.isNaN(new Date('nonsense').getHours())).toBe(true);
  });
});
