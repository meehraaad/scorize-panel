import type { ReactNode } from 'react';

const TONES = {
  primary: 'bg-tint text-primary-text',
  good: 'bg-good-tint text-good',
  warn: 'bg-warn-tint text-warn',
  danger: 'bg-danger-tint text-danger',
  info: 'bg-info-tint text-info',
  neutral: 'bg-neutral-tint text-neutral',
} as const;

export type ChipTone = keyof typeof TONES;

interface ChipProps {
  tone: ChipTone;
  /** A status dot before the text (results, states); off for plain labels. */
  dot?: boolean;
  small?: boolean;
  children: ReactNode;
}

/** Status pill: "Accepted", "Paid", "Waiting for your approval". */
export function Chip({ tone, dot = false, small = false, children }: ChipProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium whitespace-nowrap ${
        small ? 'h-6 px-2.5 text-xs' : 'h-7 px-3 text-[13px]'
      } ${TONES[tone]}`}
    >
      {dot && <span aria-hidden="true" className="size-[7px] rounded-full bg-current" />}
      {children}
    </span>
  );
}

const TEXT_TONES = {
  primary: 'text-primary-text',
  good: 'text-good',
  warn: 'text-warn',
  danger: 'text-danger',
  info: 'text-info',
  neutral: 'text-text-2',
} as const satisfies Record<ChipTone, string>;

/** A status as colored text with a dot, for rows in a list where a pill would be too loud. */
export function StatusText({ tone, children }: { tone: ChipTone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[13px] font-semibold whitespace-nowrap ${TEXT_TONES[tone]}`}
    >
      <span aria-hidden="true" className="size-[7px] flex-none rounded-full bg-current" />
      {children}
    </span>
  );
}
