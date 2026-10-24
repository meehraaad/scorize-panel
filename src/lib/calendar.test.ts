import { describe, expect, it } from 'vitest';
import {
  addMonths,
  fromCalendar,
  monthGrid,
  monthLength,
  parseValue,
  toCalendar,
  toValue,
} from './calendar';

describe('calendar', () => {
  it('converts between Gregorian and Jalali dates', () => {
    expect(toCalendar(new Date(2026, 9, 24), 'persian')).toEqual({ year: 1405, month: 8, day: 2 });
    expect(toCalendar(new Date(2026, 2, 21), 'persian')).toEqual({ year: 1405, month: 1, day: 1 });
    expect(toCalendar(new Date(2025, 2, 20), 'persian')).toEqual({
      year: 1403,
      month: 12,
      day: 30,
    });
    expect(fromCalendar({ year: 1405, month: 8, day: 2 }, 'persian')).toEqual(
      new Date(2026, 9, 24),
    );
    expect(fromCalendar({ year: 1379, month: 4, day: 12 }, 'persian')).toEqual(
      new Date(2000, 6, 2),
    );
  });

  it('agrees with Intl for every day of a few years', () => {
    const intl = new Intl.DateTimeFormat('en-u-ca-persian', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    });
    for (
      let day = new Date(2023, 0, 1);
      day < new Date(2027, 0, 1);
      day.setDate(day.getDate() + 1)
    ) {
      const parts = Object.fromEntries(
        intl.formatToParts(day).map((part) => [part.type, part.value]),
      );
      expect(toCalendar(day, 'persian')).toEqual({
        year: Number(parts.year?.split(' ')[0]),
        month: Number(parts.month),
        day: Number(parts.day),
      });
    }
  });

  it('knows month lengths, leap years included', () => {
    expect(monthLength(1403, 12, 'persian')).toBe(30); // leap year
    expect(monthLength(1404, 12, 'persian')).toBe(29);
    expect(monthLength(1405, 1, 'persian')).toBe(31);
    expect(monthLength(1405, 7, 'persian')).toBe(30);
    expect(monthLength(2024, 2, 'gregorian')).toBe(29);
  });

  it('moves by months and builds weeks from Saturday (Persian) or Monday', () => {
    expect(addMonths({ year: 1405, month: 6, day: 31 }, 1, 'persian')).toEqual({
      year: 1405,
      month: 7,
      day: 30,
    });
    expect(addMonths({ year: 1405, month: 1, day: 5 }, -1, 'persian')).toEqual({
      year: 1404,
      month: 12,
      day: 5,
    });
    const persian = monthGrid(1405, 8, 'persian');
    expect(persian).toHaveLength(6);
    expect(persian[0]?.[0]?.getDay()).toBe(6);
    expect(persian.flat().some((day) => day.getTime() === new Date(2026, 9, 23).getTime())).toBe(
      true,
    );
    expect(monthGrid(2026, 10, 'gregorian')[0]?.[0]?.getDay()).toBe(1);
  });

  it('reads and writes the value strings', () => {
    const date = new Date(2026, 10, 1, 9, 5);
    expect(toValue(date, false)).toBe('2026-11-01');
    expect(toValue(date, true)).toBe('2026-11-01T09:05');
    expect(parseValue('2026-11-01T09:05')).toEqual(date);
    expect(parseValue('2026-11-01')).toEqual(new Date(2026, 10, 1));
    expect(parseValue('')).toBeNull();
    expect(parseValue('11/01/2026')).toBeNull();
  });
});
