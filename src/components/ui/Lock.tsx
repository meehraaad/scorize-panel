import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

const TONES = {
  /** Dark, like the case card: the strongest invitation (no contract yet). */
  hero: {
    box: 'bg-hero text-on-hero shadow-hero',
    icon: 'bg-hero-raised text-hero-current',
    kicker: 'text-hero-current',
    text: 'text-on-hero-2',
  },
  info: {
    box: 'bg-surface text-text shadow-panel',
    icon: 'bg-info-tint text-info',
    kicker: 'text-info',
    text: 'text-text-2',
  },
  primary: {
    box: 'bg-surface text-text shadow-panel',
    icon: 'bg-tint text-primary-text',
    kicker: 'text-primary-text',
    text: 'text-text-2',
  },
  neutral: {
    box: 'bg-surface text-text shadow-panel',
    icon: 'bg-neutral-tint text-neutral',
    kicker: 'text-text-2',
    text: 'text-text-2',
  },
} as const;

export type LockTone = keyof typeof TONES;

/**
 * Why a section isn't open to this user, and what to do about it: one banner, four looks (no
 * contract, contract in review, service not in the contract, contract ended). Sits above the
 * section's preview. Actions are links or buttons the caller passes; on the hero tone, outline
 * buttons should use `lockButtonOnHero`.
 */
export function LockBanner({
  tone,
  icon,
  label,
  kicker,
  title,
  text,
  actions,
}: {
  tone: LockTone;
  icon: IconName;
  /** Names the region for screen readers ("This section is locked"). */
  label: string;
  kicker: string;
  title: string;
  text: string;
  actions?: ReactNode;
}) {
  const look = TONES[tone];
  return (
    <section
      aria-label={label}
      className={`flex flex-wrap items-center gap-x-6 gap-y-[18px] rounded-[22px] p-5 lg:rounded-[26px] lg:px-7 lg:py-6 ${look.box}`}
    >
      <span
        aria-hidden="true"
        className={`flex size-[52px] flex-none items-center justify-center rounded-2xl ${look.icon}`}
      >
        <Icon name={icon} size={24} />
      </span>
      <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-1.5">
        <span className={`text-[13px] font-semibold ${look.kicker}`}>{kicker}</span>
        <span className="font-display text-[19px] leading-relaxed font-bold">{title}</span>
        <span className={`text-sm leading-7 ${look.text}`}>{text}</span>
      </div>
      {actions && (
        <div className="flex flex-wrap gap-2 max-sm:w-full [&>*]:flex-auto">{actions}</div>
      )}
    </section>
  );
}

/** An outline button that reads on the dark banner. */
export const lockButtonOnHero =
  'bg-transparent! text-on-hero! shadow-[inset_0_0_0_1px_var(--hero-line)]! hover:shadow-[inset_0_0_0_1px_var(--on-hero-2)]!';

/** "Preview · sample data, not your case", under the banner. */
export function PreviewChip({ children }: { children: string }) {
  return (
    <span className="inline-flex h-[30px] items-center gap-2 self-start rounded-full bg-surface px-3 text-[13px] font-medium text-text-2 shadow-[inset_0_0_0_1px_var(--line-2)]">
      <Icon name="eye" size={15} />
      {children}
    </span>
  );
}

/**
 * Sample content under a lock banner: shown faded so people see what they'll get, but `inert`
 * (no focus, no clicks, hidden from screen readers, which hear the banner instead).
 */
export function PreviewArea({ children }: { children: ReactNode }) {
  return (
    <div
      inert
      className="pointer-events-none flex flex-col gap-4 opacity-45 saturate-50 select-none lg:gap-7"
    >
      {children}
    </div>
  );
}
