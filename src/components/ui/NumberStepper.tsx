import { useState } from 'react';
import { useFormat } from '@/lib/i18n/useFormat';
import { toLatinDigits } from '@/lib/text';

/**
 * One number with − and + beside it, also typed in (any digits): a target, a percent. The value
 * is shown in the user's digits with `unit` after it; while typing, plain digits (no grouping). A
 * value outside [min, max] is kept at the nearest end.
 */
export function NumberStepper({
  label,
  value,
  onChange,
  step = 1,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
  unit = '',
  decreaseLabel,
  increaseLabel,
}: {
  /** Names the input for screen readers (the visible words sit around the stepper). */
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
  max?: number;
  unit?: string;
  decreaseLabel: string;
  increaseLabel: string;
}) {
  const f = useFormat();
  const [typing, setTyping] = useState<string | null>(null);
  const clamp = (next: number) => Math.min(Math.max(next, min), max);
  const round = (next: number) => Math.round(next * 100) / 100;
  const commit = () => {
    if (typing === null) return;
    const parsed = Number(
      toLatinDigits(typing)
        .trim()
        .replace(/[٬,\s]/g, '')
        .replace('٫', '.'),
    );
    if (typing.trim() && Number.isFinite(parsed)) onChange(clamp(round(parsed)));
    setTyping(null);
  };
  const button =
    'flex size-11 flex-none items-center justify-center bg-canvas text-xl text-text-2 hover:text-text disabled:opacity-40';
  return (
    <span className="inline-flex items-center overflow-hidden rounded-xl shadow-[inset_0_0_0_1px_var(--line-2)]">
      <button
        type="button"
        aria-label={decreaseLabel}
        className={button}
        disabled={value <= min}
        onClick={() => onChange(clamp(round(value - step)))}
      >
        −
      </button>
      <span className="flex min-w-24 items-center justify-center gap-1 px-2">
        <input
          aria-label={label}
          inputMode="decimal"
          className="bg-transparent text-center text-[17px] font-bold text-primary-text outline-none"
          style={{ width: `${String(Math.max(3, (typing ?? f.number(value)).length) + 1)}ch` }}
          value={typing ?? f.number(value)}
          onFocus={() => setTyping(String(value))}
          onChange={(event) => setTyping(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commit();
          }}
        />
        {unit && <span className="text-[13px] text-text-2">{unit}</span>}
      </span>
      <button
        type="button"
        aria-label={increaseLabel}
        className={button}
        disabled={value >= max}
        onClick={() => onChange(clamp(round(value + step)))}
      >
        +
      </button>
    </span>
  );
}
