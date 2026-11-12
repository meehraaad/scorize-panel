import type { ChipTone } from '@/components/ui/Chip';
import { ApiError } from '@/lib/api/client';
import { toLatinDigits } from '@/lib/text';
import type { ContractKind, HrEventKind, StaffState } from './api';

export const STATE_TONE: Record<StaffState, ChipTone> = {
  active: 'good',
  trial: 'info',
  joining: 'primary',
  leaving: 'warn',
  inactive: 'neutral',
};

export const CONTRACT_TONE: Record<ContractKind, ChipTone> = {
  trial: 'info',
  fixed: 'primary',
  permanent: 'good',
  project: 'neutral',
};

/** HR's days on the calendar, each in its own colour. */
export const EVENT_COLOR: Record<HrEventKind, string> = {
  entry: 'var(--cal-2)',
  exit: 'var(--cal-6)',
  trial_end: 'var(--cal-1)',
  contract_end: 'var(--cal-4)',
  birthday: 'var(--cal-3)',
};

/** A whole number of Tomans typed with Persian or Latin digits and separators; null if none. */
export function parseAmount(value: string) {
  const digits = toLatinDigits(value).replace(/\D/g, '');
  return digits ? Number(digits) : null;
}

/** Django's field errors (`{field: [message]}`) as one message per field. */
export function fieldErrors(error: unknown): Record<string, string> {
  if (!(error instanceof ApiError) || error.status !== 400 || !error.body) return {};
  const body = error.body as Record<string, unknown>;
  return Object.fromEntries(
    Object.entries(body).flatMap(([field, value]) =>
      Array.isArray(value) && typeof value[0] === 'string' ? [[field, value[0]]] : [],
    ),
  );
}

/** Today's local `YYYY-MM-DD`. */
export function todayValue() {
  const now = new Date();
  return `${String(now.getFullYear())}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/** Whole days from today to a `YYYY-MM-DD` (negative: past). */
export function daysUntil(day: string) {
  const [year, month, date] = day.split('-').map(Number);
  const target = new Date(year ?? 0, (month ?? 1) - 1, date ?? 1);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

/** A `YYYY-MM-DD` as a local date (not UTC midnight, which is the day before west of Greenwich). */
export function dayOf(value: string) {
  const [year, month, date] = value.split('-').map(Number);
  return new Date(year ?? 0, (month ?? 1) - 1, date ?? 1);
}
