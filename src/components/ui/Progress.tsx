import { stepState, type StepState } from '@/lib/progress';
import { Icon } from './Icon';

interface ProgressBarProps {
  /** 0–100. */
  value: number;
  /** `sm` 6px (forms, hero), `md` 8px (cards). */
  size?: 'sm' | 'md';
  /**
   * `onHero`: light bar on the dark case card; `luxe`: gold on the premium card; `good`: money paid,
   * things done; `warn`: too much.
   */
  tone?: 'primary' | 'good' | 'warn' | 'onHero' | 'luxe';
  /** Read by screen readers. Without it the bar is decoration next to a visible "3 of 5". */
  label?: string;
  className?: string;
}

/** A horizontal progress bar. */
export function ProgressBar({
  value,
  size = 'md',
  tone = 'primary',
  label,
  className = '',
}: ProgressBarProps) {
  const height = size === 'sm' ? 'h-1.5' : 'h-2';
  const track = tone === 'onHero' || tone === 'luxe' ? 'bg-hero-line' : 'bg-track';
  const fill = {
    primary: 'bg-primary',
    good: 'bg-good',
    warn: 'bg-hero-current',
    onHero: 'bg-on-hero',
    luxe: 'bg-luxe-gold-light',
  }[tone];
  const a11y = label
    ? {
        role: 'progressbar',
        'aria-label': label,
        'aria-valuemin': 0,
        'aria-valuemax': 100,
        'aria-valuenow': value,
      }
    : { 'aria-hidden': true };
  return (
    <div {...a11y} className={`${height} rounded-full ${track} ${className}`}>
      <div className={`${height} rounded-full ${fill}`} style={{ width: `${String(value)}%` }} />
    </div>
  );
}

interface StepBarProps {
  /** Ordered list label ("Case stages"). */
  label: string;
  /** `hint`: a line under the step's name, from lg up (an overview of the steps). */
  steps: readonly { key: string; label: string; hint?: string }[];
  /** Index of the current step; steps before it are done. -1: none reached (an overview). */
  current: number;
  /** The current step is finished as well (visa granted, file closed). */
  finished?: boolean;
  /** `onHero`: on the dark case card. */
  tone?: 'surface' | 'onHero';
  className?: string;
}

/** Steps as a row of segments with names under them: case stages, visa steps, writing steps. */
export function StepBar({
  label,
  steps,
  current,
  finished = false,
  tone = 'surface',
  className = '',
}: StepBarProps) {
  const hero = tone === 'onHero';
  const bar: Record<StepState, string> = hero
    ? { done: 'bg-on-hero', current: 'bg-hero-current', todo: 'bg-hero-line' }
    : { done: 'bg-primary', current: 'bg-hero-current', todo: 'bg-track' };
  const text: Record<StepState, string> = hero
    ? { done: 'text-on-hero-2', current: 'font-bold text-on-hero', todo: 'text-on-hero-3' }
    : { done: 'text-text', current: 'font-bold text-text', todo: 'text-text-2' };
  // No step reached yet: every step reads as plainly as the others (what the journey holds).
  const overview = current < 0;

  return (
    <ol
      aria-label={label}
      className={`m-0 grid list-none gap-1.5 p-0 ${className}`}
      style={{ gridTemplateColumns: `repeat(${String(steps.length)}, minmax(0, 1fr))` }}
    >
      {steps.map((step, index) => {
        const state = stepState(index, current, finished);
        return (
          <li
            key={step.key}
            aria-current={state === 'current' ? 'step' : undefined}
            className="flex min-w-0 flex-col gap-2"
          >
            <span
              aria-hidden="true"
              className={`h-1 rounded-full ${overview ? (hero ? 'bg-hero-line' : 'bg-track') : bar[state]}`}
            />
            <span
              className={`truncate text-[11px] lg:text-sm ${
                overview ? `font-medium ${hero ? 'text-on-hero' : 'text-text'}` : text[state]
              }`}
            >
              {step.label}
            </span>
            {step.hint && (
              <span
                className={`hidden text-xs leading-6 lg:block ${hero ? 'text-on-hero-2' : 'text-text-2'}`}
              >
                {step.hint}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** Numbered dot of a step: ✓ when done, ring when current, grey when to come. */
export function StepDot({
  number,
  state,
  size = 'md',
}: {
  /** Already formatted for the locale ("۳"). */
  number: string;
  state: StepState;
  /** xs 22px (lists), sm 26px (side menu), md 32px (section headers). */
  size?: 'xs' | 'sm' | 'md';
}) {
  const box = { xs: 'size-[22px] text-xs', sm: 'size-[26px] text-xs', md: 'size-8 text-sm' }[size];
  const look = {
    done: 'bg-primary text-on-primary',
    current: 'text-primary-text shadow-[inset_0_0_0_1.5px_var(--primary)]',
    todo: 'text-text-2 shadow-[inset_0_0_0_1.5px_var(--line-2)]',
  }[state];
  return (
    <span
      aria-hidden="true"
      className={`flex flex-none items-center justify-center rounded-full font-bold ${box} ${look}`}
    >
      {state === 'done' ? <Icon name="check" size={size === 'md' ? 16 : 14} /> : number}
    </span>
  );
}

/** Steps as a vertical numbered list: writing order progress, onboarding steps. */
export function StepList({
  label,
  steps,
  current,
  formatNumber,
}: {
  label: string;
  steps: readonly { key: string; label: string }[];
  /** Index of the current step; `steps.length` when all are done. */
  current: number;
  formatNumber: (value: number) => string;
}) {
  return (
    <ol aria-label={label} className="m-0 flex list-none flex-col gap-2.5 p-0">
      {steps.map((step, index) => {
        const state = stepState(index, current);
        return (
          <li
            key={step.key}
            aria-current={state === 'current' ? 'step' : undefined}
            className={`flex items-center gap-2.5 text-sm ${
              state === 'current'
                ? 'font-semibold text-text'
                : state === 'done'
                  ? 'text-text'
                  : 'text-text-2'
            }`}
          >
            <StepDot number={formatNumber(index + 1)} state={state} size="xs" />
            {step.label}
          </li>
        );
      })}
    </ol>
  );
}

/**
 * A round progress meter with the value in words beside it (a quiz's "profile 60% complete").
 * `onHero`: on the dark hero card; `luxe`: gold, on the premium card.
 */
export function ProgressRing({
  value,
  label,
  size = 64,
  tone = 'surface',
}: {
  /** 0–100. */
  value: number;
  /** Read by screen readers ("Profile 60% complete"). */
  label: string;
  size?: number;
  tone?: 'surface' | 'onHero' | 'luxe';
}) {
  const radius = 27;
  const circumference = 2 * Math.PI * radius;
  const hero = tone !== 'surface';
  return (
    <svg
      role="img"
      aria-label={label}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className="flex-none -rotate-90"
    >
      <circle
        cx="32"
        cy="32"
        r={radius}
        fill="none"
        strokeWidth="7"
        className={hero ? 'stroke-hero-line' : 'stroke-track'}
      />
      {value > 0 && (
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={`${String((circumference * Math.min(Math.max(value, 0), 100)) / 100)} ${String(circumference)}`}
          className={`transition-[stroke-dasharray] duration-500 motion-reduce:transition-none ${
            tone === 'luxe'
              ? 'stroke-luxe-gold-light'
              : hero
                ? 'stroke-hero-accent'
                : 'stroke-primary'
          }`}
        />
      )}
    </svg>
  );
}
