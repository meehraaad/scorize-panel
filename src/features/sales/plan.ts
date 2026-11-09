import type { Instalment } from './api';

/** The first instalment of a suggested schedule is this share of the total, rounded to 100,000 toman. */
const FIRST_SHARE = 0.4;
const ROUND = 100_000;

/** The ISO date (yyyy-mm-dd) `months` after `start`. */
function monthsAfter(start: string, months: number) {
  const from = new Date(start);
  const date = new Date(from.getFullYear(), from.getMonth() + months, from.getDate());
  return `${String(date.getFullYear())}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/**
 * A starting point the seller changes to what the customer agrees in the session (S47): the
 * prepayment at signing, then one a month after the start date.
 */
export function suggestedSchedule(total: number, count: number, start: string): Instalment[] {
  if (count <= 1) return [{ amount: total, when: 'signing', date: null }];
  const first = Math.round((total * FIRST_SHARE) / ROUND) * ROUND;
  const rest = splitEvenly(total - first, count - 1);
  return [
    { amount: first, when: 'signing', date: null },
    ...rest.map((amount, index) => ({
      amount,
      when: 'date' as const,
      date: monthsAfter(start, index + 1),
    })),
  ];
}

/** `total` in `count` parts rounded to 1,000 toman; the last takes what rounding leaves. */
function splitEvenly(total: number, count: number) {
  const part = Math.floor(total / count / 1000) * 1000;
  return Array.from({ length: count }, (_, index) =>
    index === count - 1 ? total - part * (count - 1) : part,
  );
}

/** Keeps the prepayment and spreads what is left of `total` over the other rows. */
export function spreadRest(schedule: Instalment[], total: number): Instalment[] {
  const [first, ...rest] = schedule;
  if (!first) return schedule;
  if (rest.length === 0) return [{ ...first, amount: total }];
  const parts = splitEvenly(Math.max(total - first.amount, 0), rest.length);
  return [first, ...rest.map((row, index) => ({ ...row, amount: parts[index] ?? 0 }))];
}

export const scheduleTotal = (schedule: Instalment[]) =>
  schedule.reduce((sum, row) => sum + row.amount, 0);

/** Every row has an amount, and a dated row has its date. */
export const scheduleComplete = (schedule: Instalment[]) =>
  schedule.length > 0 &&
  schedule.every((row) => row.amount > 0 && (row.when !== 'date' || Boolean(row.date)));
