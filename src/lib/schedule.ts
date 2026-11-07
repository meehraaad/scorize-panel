const MINUTE = 60_000;

/** A row of a day's list: an item, the line at the current time, or free time ahead. */
export type ListRow<T> =
  { kind: 'item'; item: T } | { kind: 'now' } | { kind: 'free'; from: number; minutes: number };

/**
 * A day's timed items, in order, with the "now" line among them and a hint wherever a free
 * stretch of at least `freeMinutes` is still ahead. `at` and `end` say when an item starts and
 * is over (ms). Shared by every list shape of the schedule (today's timetable first).
 */
export function listRowsOf<T>(
  items: readonly T[],
  now: number,
  {
    at,
    end,
    freeMinutes,
  }: { at: (item: T) => number; end: (item: T) => number; freeMinutes: number },
): ListRow<T>[] {
  const rows: ListRow<T>[] = [];
  let placedNow = false;
  let freeFrom = now;
  const free = (until: number) => {
    const from = Math.max(freeFrom, now);
    const minutes = Math.floor((until - from) / MINUTE);
    if (minutes >= freeMinutes) rows.push({ kind: 'free', from, minutes });
  };
  for (const item of items) {
    const start = at(item);
    if (!placedNow && start > now) {
      rows.push({ kind: 'now' });
      placedNow = true;
    }
    if (placedNow) free(start);
    rows.push({ kind: 'item', item });
    freeFrom = Math.max(freeFrom, end(item));
  }
  if (!placedNow) rows.push({ kind: 'now' });
  return rows;
}
