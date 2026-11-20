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
  look = 'field',
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
  /** `field`: a small boxed stepper; `hero`: one large number between round buttons (a quiz). */
  look?: 'field' | 'hero';
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
  const hero = look === 'hero';
  const button = hero
    ? 'flex size-14 flex-none items-center justify-center rounded-full bg-canvas text-2xl text-text hover:bg-track disabled:opacity-40'
    : 'flex size-11 flex-none items-center justify-center bg-canvas text-xl text-text-2 hover:text-text disabled:opacity-40';
  return (
    <span
      className={
        hero
          ? 'inline-flex items-center gap-4 lg:gap-6'
          : 'inline-flex items-center overflow-hidden rounded-xl shadow-[inset_0_0_0_1px_var(--line-2)]'
      }
    >
      <button
        type="button"
        aria-label={decreaseLabel}
        className={button}
        disabled={value <= min}
        onClick={() => onChange(clamp(round(value - step)))}
      >
        −
      </button>
      <span
        className={`flex items-center justify-center gap-1 px-2 ${hero ? 'min-w-40' : 'min-w-24'}`}
      >
        <input
          aria-label={label}
          inputMode="decimal"
          className={
            hero
              ? 'bg-transparent text-center text-7xl leading-none font-normal tracking-tight text-text tabular-nums outline-none'
              : 'bg-transparent text-center text-[17px] font-bold text-primary-text outline-none'
          }
          style={{
            width: `${String(Math.max(hero ? 2 : 3, (typing ?? f.number(value)).length) + (hero ? 0.5 : 1))}ch`,
          }}
          value={typing ?? f.number(value)}
          onFocus={() => setTyping(String(value))}
          onChange={(event) => setTyping(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commit();
          }}
        />
        {unit && (
          <span className={hero ? 'text-lg text-text-2' : 'text-[13px] text-text-2'}>{unit}</span>
        )}
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
