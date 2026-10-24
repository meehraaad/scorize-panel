/** Quick follow-up times, as the seller picks them ("tomorrow", "next week"), in local time. */
export type QuickWhen = 'hour' | 'evening' | 'tomorrow' | 'three' | 'week';

const EVENING_HOUR = 18;
const MORNING_HOUR = 10;

export function quickWhen(choice: QuickWhen, now = new Date()): Date {
  const date = new Date(now);
  switch (choice) {
    case 'hour':
      return new Date(now.getTime() + 3_600_000);
    case 'evening':
      date.setHours(EVENING_HOUR, 0, 0, 0);
      // Already evening: the same hour tomorrow.
      if (date <= now) date.setDate(date.getDate() + 1);
      return date;
    case 'tomorrow':
      date.setDate(date.getDate() + 1);
      break;
    case 'three':
      date.setDate(date.getDate() + 3);
      break;
    case 'week':
      date.setDate(date.getDate() + 7);
      break;
  }
  date.setHours(MORNING_HOUR, 0, 0, 0);
  return date;
}

/** `<input type="datetime-local">` value → ISO string (null when empty or invalid). */
export function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
