import type { ReactNode } from 'react';

const TONES = {
  error: 'bg-danger-tint text-danger',
  info: 'bg-neutral-tint text-neutral',
  success: 'bg-good-tint text-good',
} as const;

/** Inline message. Errors use role="alert" so screen readers announce them immediately. */
export function Notice({ tone, children }: { tone: keyof typeof TONES; children: ReactNode }) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`rounded-2xl px-4 py-3 text-[15px] leading-7 ${TONES[tone]}`}
    >
      {children}
    </div>
  );
}
