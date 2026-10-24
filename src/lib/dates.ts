const DAY = 86_400_000;

/** Whole days from now until `value` (0 once it has passed). */
export function daysUntil(value: string, now = Date.now()) {
  return Math.max(0, Math.ceil((new Date(value).getTime() - now) / DAY));
}

/** Whole days between two dates. */
export function daysBetween(start: string, end: string) {
  return Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / DAY));
}

/** The moment has passed. */
export function isPast(value: string, now = Date.now()) {
  return new Date(value).getTime() < now;
}

/** Whole days since `value` passed (0 while it hasn't). */
export function daysSince(value: string, now = Date.now()) {
  return Math.max(0, Math.floor((now - new Date(value).getTime()) / DAY));
}
