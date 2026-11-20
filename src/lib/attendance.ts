/**
 * The office terminal's days (lang `attendance/summary.py`), shared by the attendance section, HR
 * and every panel that shows a person their own attendance (marketing's "my performance").
 */

/** `pending`: today, not in yet. */
export type DayStatus = 'present' | 'late' | 'absent' | 'pending';

/** Each status's chip tone (`Chip`). */
export const STATUS_TONE = {
  present: 'good',
  late: 'warn',
  absent: 'danger',
  pending: 'neutral',
} as const satisfies Record<DayStatus, string>;

/** "8:25" from seconds, for the caller's `digits()`. */
export function clockOf(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return `${String(Math.floor(minutes / 60))}:${String(minutes % 60).padStart(2, '0')}`;
}
