/**
 * The panel shows and reads every time in Tehran time, whatever time zone the computer is set to.
 *
 * Code everywhere reads dates with the browser's local getters (`getHours`, `setHours`,
 * `new Date(y, m, d, h)`, naive `YYYY-MM-DDTHH:mm` strings, Intl without a `timeZone`). Those
 * follow the computer's time zone, and many office and home computers in Iran are set to another
 * one (+03:00 or +04:00, with the clock moved by hand): their calendars drew a 14:00 session at
 * 13:30 or 14:30, and a time picked there was saved 30 minutes off.
 *
 * Instead of threading a time zone through every date call, `installTehranTime()` (run first in
 * `main.tsx` and in the test setup) makes "local" mean Tehran: `Date` becomes a subclass whose local
 * getters, setters, constructor and naive-string parsing use Tehran's offset, and
 * `Intl.DateTimeFormat` defaults to `Asia/Tehran`. Moments (`getTime`, ISO strings, `Date.now`) are
 * unchanged, so what reaches Django is the same instant as before.
 *
 * Iran has kept UTC+03:30 all year since 2022 (no daylight saving), so the offset is fixed.
 */

export const TIME_ZONE = 'Asia/Tehran';
const SHIFT = 210 * 60_000;

/** An ISO date and time with no zone (`2026-11-17T14:00`, `2026-11-17 14:00:05.5`): local time. */
const NAIVE = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3})\d*)?)?$/;

type NativeDateConstructor = DateConstructor;

const installed = Symbol.for('scorize.tehranTime');

/** The `Date` subclass for a native `Date` (exported for the tests). */
export function makeTehranDate(NativeDate: NativeDateConstructor) {
  const fromParts = (parts: number[]) => {
    const [year = NaN, month = 0, day = 1, hours = 0, minutes = 0, seconds = 0, ms = 0] = parts;
    return NativeDate.UTC(year, month, day, hours, minutes, seconds, ms) - SHIFT;
  };

  const parse = (value: string) => {
    const match = NAIVE.exec(value.trim());
    if (!match) return NativeDate.parse(value);
    const [, y, mo, d, h, mi, s = '0', ms = '0'] = match;
    return fromParts([
      Number(y),
      Number(mo) - 1,
      Number(d),
      Number(h),
      Number(mi),
      Number(s),
      Number(ms.padEnd(3, '0')),
    ]);
  };

  // The same moment with Tehran's wall clock in its UTC fields.
  const shifted = (date: Date) => new NativeDate(NativeDate.prototype.getTime.call(date) + SHIFT);

  class TehranDate extends NativeDate {
    constructor(...args: unknown[]) {
      if (args.length === 0) super();
      else if (args.length === 1) {
        const [value] = args;
        if (typeof value === 'string') super(parse(value));
        else if (value instanceof NativeDate) super(NativeDate.prototype.getTime.call(value));
        else super(value as number);
      } else super(fromParts(args.map(Number)));
    }

    static override parse(value: string) {
      return parse(value);
    }

    static override [Symbol.hasInstance](value: unknown) {
      return value instanceof NativeDate;
    }

    override getTimezoneOffset() {
      return Number.isNaN(this.getTime()) ? NaN : -SHIFT / 60_000;
    }

    override getFullYear() {
      return shifted(this).getUTCFullYear();
    }
    override getMonth() {
      return shifted(this).getUTCMonth();
    }
    override getDate() {
      return shifted(this).getUTCDate();
    }
    override getDay() {
      return shifted(this).getUTCDay();
    }
    override getHours() {
      return shifted(this).getUTCHours();
    }
    override getMinutes() {
      return shifted(this).getUTCMinutes();
    }
    override getSeconds() {
      return shifted(this).getUTCSeconds();
    }
    override getMilliseconds() {
      return shifted(this).getUTCMilliseconds();
    }

    override setFullYear(...args: [number, number?, number?]) {
      return this.#set('setUTCFullYear', args);
    }
    override setMonth(...args: [number, number?]) {
      return this.#set('setUTCMonth', args);
    }
    override setDate(...args: [number]) {
      return this.#set('setUTCDate', args);
    }
    override setHours(...args: [number, number?, number?, number?]) {
      return this.#set('setUTCHours', args);
    }
    override setMinutes(...args: [number, number?, number?]) {
      return this.#set('setUTCMinutes', args);
    }
    override setSeconds(...args: [number, number?]) {
      return this.#set('setUTCSeconds', args);
    }
    override setMilliseconds(...args: [number]) {
      return this.#set('setUTCMilliseconds', args);
    }

    /** Set Tehran wall-clock fields: the UTC setter on the shifted moment, shifted back. */
    #set(setter: SetterName, args: (number | undefined)[]) {
      const wall = shifted(this);
      // Only the arguments given (a trailing `undefined` would make the date invalid).
      (wall[setter] as (...values: (number | undefined)[]) => number)(...args);
      return this.setTime(wall.getTime() - SHIFT);
    }

    override toString(): string {
      if (Number.isNaN(this.getTime())) return 'Invalid Date';
      return `${this.toDateString()} ${this.toTimeString()}`;
    }
    override toDateString(): string {
      if (Number.isNaN(this.getTime())) return 'Invalid Date';
      // "Tue, 17 Nov 2026 10:30:00 GMT" → "Tue Nov 17 2026".
      const [weekday = '', day = '', month = '', year = '']: string[] = shifted(this)
        .toUTCString()
        .replace(',', '')
        .split(' ');
      return `${weekday} ${month} ${day} ${year}`;
    }
    override toTimeString(): string {
      if (Number.isNaN(this.getTime())) return 'Invalid Date';
      const time = shifted(this).toISOString().slice(11, 19);
      return `${time} GMT+0330 (Iran Standard Time)`;
    }
    override toLocaleString(locales?: string | string[], options?: Intl.DateTimeFormatOptions) {
      return super.toLocaleString(locales, {
        ...options,
        timeZone: options?.timeZone ?? TIME_ZONE,
      });
    }
    override toLocaleDateString(locales?: string | string[], options?: Intl.DateTimeFormatOptions) {
      return super.toLocaleDateString(locales, {
        ...options,
        timeZone: options?.timeZone ?? TIME_ZONE,
      });
    }
    override toLocaleTimeString(locales?: string | string[], options?: Intl.DateTimeFormatOptions) {
      return super.toLocaleTimeString(locales, {
        ...options,
        timeZone: options?.timeZone ?? TIME_ZONE,
      });
    }
  }

  // `Date('…')` called without `new` returns the current time as a string, like the native one.
  return new Proxy(TehranDate, {
    apply: () => new TehranDate().toString(),
  }) as unknown as DateConstructor;
}

type SetterName =
  | 'setUTCFullYear'
  | 'setUTCMonth'
  | 'setUTCDate'
  | 'setUTCHours'
  | 'setUTCMinutes'
  | 'setUTCSeconds'
  | 'setUTCMilliseconds';

/** `Intl.DateTimeFormat` that formats in Tehran time unless a `timeZone` is given. */
export function makeTehranFormat(NativeFormat: typeof Intl.DateTimeFormat) {
  const TehranFormat = function (
    locales?: string | string[],
    options?: Intl.DateTimeFormatOptions,
  ) {
    return new NativeFormat(locales, { ...options, timeZone: options?.timeZone ?? TIME_ZONE });
  } as unknown as typeof Intl.DateTimeFormat;
  Object.defineProperty(TehranFormat, 'prototype', { value: NativeFormat.prototype });
  TehranFormat.supportedLocalesOf = NativeFormat.supportedLocalesOf.bind(NativeFormat);
  return TehranFormat;
}

/** Make the page's local time Tehran time (once; see the comment at the top). */
export function installTehranTime() {
  const global = globalThis as typeof globalThis & { [installed]?: true };
  if (global[installed]) return;
  global[installed] = true;
  global.Date = makeTehranDate(global.Date);
  Intl.DateTimeFormat = makeTehranFormat(Intl.DateTimeFormat);
}
