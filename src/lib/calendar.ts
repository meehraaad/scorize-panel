/**
 * Calendar math for the date picker: the Persian (Jalali) calendar for Persian, Gregorian for
 * other languages. Intl can format Persian dates but not build them (no "the 1st of Aban"), so the
 * Jalali conversion is done here (the jalaali-js algorithm, ~40 lines instead of a dependency).
 *
 * Values travel as the same strings native inputs use, in local time:
 * `YYYY-MM-DD` (date) and `YYYY-MM-DDTHH:mm` (date and time).
 */

export type CalendarKind = 'persian' | 'gregorian';

/** A day in a calendar: month 1–12. */
export interface CalendarDay {
  year: number;
  month: number;
  day: number;
}

// ── Jalali ⇄ Gregorian (jalaali-js, MIT) ─────────────────────────────────────────────────────

const div = (a: number, b: number) => Math.trunc(a / b);
const mod = (a: number, b: number) => a - Math.trunc(a / b) * b;

const BREAKS = [
  -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394,
  2456, 3178,
];

/** Leap info of a Jalali year and the Gregorian day of March its year starts on. */
function jalCal(jy: number) {
  const gy = jy + 621;
  let leapJ = -14;
  let jp = BREAKS[0] ?? 0;
  let jump = 0;
  for (let i = 1; i < BREAKS.length; i++) {
    const jm = BREAKS[i] ?? 0;
    jump = jm - jp;
    if (jy < jm) break;
    leapJ += div(jump, 33) * 8 + div(mod(jump, 33), 4);
    jp = jm;
  }
  let n = jy - jp;
  leapJ += div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
  if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;
  const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
  const march = 20 + leapJ - leapG;
  if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
  let leap = mod(mod(n + 1, 33) - 1, 4);
  if (leap === -1) leap = 4;
  return { leap, gy, march };
}

/** Gregorian date → Julian day number. */
function g2d(gy: number, gm: number, gd: number) {
  const d =
    div((gy + div(gm - 8, 6) + 100100) * 1461, 4) +
    div(153 * mod(gm + 9, 12) + 2, 5) +
    gd -
    34840408;
  return d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
}

/** Julian day number → Gregorian date. */
function d2g(jdn: number) {
  let j = 4 * jdn + 139361631;
  j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
  const i = div(mod(j, 1461), 4) * 5 + 308;
  const gd = div(mod(i, 153), 5) + 1;
  const gm = mod(div(i, 153), 12) + 1;
  const gy = div(j, 1461) - 100100 + div(8 - gm, 6);
  return { year: gy, month: gm, day: gd };
}

function j2d(jy: number, jm: number, jd: number) {
  const r = jalCal(jy);
  return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1;
}

function d2j(jdn: number): CalendarDay {
  const g = d2g(jdn);
  let jy = g.year - 621;
  const r = jalCal(jy);
  const start = g2d(g.year, 3, r.march);
  let k = jdn - start;
  if (k >= 0) {
    if (k <= 185) return { year: jy, month: 1 + div(k, 31), day: mod(k, 31) + 1 };
    k -= 186;
  } else {
    jy -= 1;
    k += 179;
    if (r.leap === 1) k += 1;
  }
  return { year: jy, month: 7 + div(k, 30), day: mod(k, 30) + 1 };
}

// ── Calendar days and JS dates ───────────────────────────────────────────────────────────────

/** The calendar day of a (local) date. */
export function toCalendar(date: Date, kind: CalendarKind): CalendarDay {
  const gregorian = { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() };
  return kind === 'gregorian'
    ? gregorian
    : d2j(g2d(gregorian.year, gregorian.month, gregorian.day));
}

/** A calendar day as a local date at midnight. */
export function fromCalendar({ year, month, day }: CalendarDay, kind: CalendarKind): Date {
  const g = kind === 'gregorian' ? { year, month, day } : d2g(j2d(year, month, day));
  return new Date(g.year, g.month - 1, g.day);
}

export function monthLength(year: number, month: number, kind: CalendarKind) {
  if (kind === 'gregorian') return new Date(year, month, 0).getDate();
  if (month <= 6) return 31;
  if (month <= 11) return 30;
  return jalCal(year).leap === 0 ? 30 : 29;
}

/** Day 0–6 the week starts on (JS getDay): Saturday in Iran, Monday elsewhere. */
export const weekStart = (kind: CalendarKind) => (kind === 'persian' ? 6 : 1);

/** Move by whole months, keeping the day inside the new month. */
export function addMonths(value: CalendarDay, months: number, kind: CalendarKind): CalendarDay {
  const index = value.year * 12 + (value.month - 1) + months;
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  return { year, month, day: Math.min(value.day, monthLength(year, month, kind)) };
}

export function addDays(date: Date, days: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

export const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

/**
 * The weeks shown for a month: full weeks from the week start, with days of the months around
 * it to fill them (6 rows, so the grid never jumps in height).
 */
export function monthGrid(year: number, month: number, kind: CalendarKind): Date[][] {
  const first = fromCalendar({ year, month, day: 1 }, kind);
  const offset = (first.getDay() - weekStart(kind) + 7) % 7;
  const start = addDays(first, -offset);
  return Array.from({ length: 6 }, (_, week) =>
    Array.from({ length: 7 }, (_, day) => addDays(start, week * 7 + day)),
  );
}

// ── The value strings ────────────────────────────────────────────────────────────────────────

const pad = (value: number) => String(value).padStart(2, '0');

/** `YYYY-MM-DD`, or with `withTime` `YYYY-MM-DDTHH:mm` (local time, like native inputs). */
export function toValue(date: Date, withTime: boolean) {
  const day = `${String(date.getFullYear())}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  return withTime ? `${day}T${pad(date.getHours())}:${pad(date.getMinutes())}` : day;
}

/** The value string as a local date; null when empty or invalid. */
export function parseValue(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(value);
  if (!match) return null;
  const [, y, m, d, h = '0', min = '0'] = match;
  const date = new Date(Number(y), Number(m) - 1, Number(d), Number(h), Number(min));
  return Number.isNaN(date.getTime()) ? null : date;
}
