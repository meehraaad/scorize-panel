const VARIANTS = {
  primary: 'bg-primary text-on-primary hover:bg-primary-hover font-semibold',
  outline:
    'bg-surface text-text font-medium shadow-[inset_0_0_0_1px_var(--line-2)] hover:shadow-[inset_0_0_0_1px_var(--line-3)]',
  /** A strong action next to a primary one (an offer card that isn't the featured one). */
  dark: 'bg-hero text-on-hero hover:bg-hero-raised font-semibold',
  danger: 'bg-transparent text-danger font-medium hover:bg-danger-tint',
  /** The main action on a luxe or forest card: gold, dark text. */
  gold: 'bg-luxe-gold font-bold shadow-[inset_0_1px_0_rgb(255_255_255/0.55)] hover:brightness-105',
  /** The second action on a luxe or forest card: a gold outline. */
  onLuxe:
    'bg-transparent text-on-hero font-semibold shadow-[inset_0_0_0_1px_var(--luxe-rim)] hover:bg-hero-raised',
} as const;

const SIZES = {
  md: 'h-11 px-5 text-[15px]',
  /** Main action of a form (login, sign-up). */
  lg: 'h-14 px-6 text-base',
} as const;

export type ButtonShape = 'pill' | 'rounded';
export type ButtonVariant = keyof typeof VARIANTS;
export type ButtonSize = keyof typeof SIZES;

/** Shared pill button styles; also used by links that look like buttons. */
export function buttonClass(
  variant: ButtonVariant = 'primary',
  className = '',
  size: ButtonSize = 'md',
  shape: ButtonShape = 'pill',
) {
  return `inline-flex items-center justify-center gap-2 whitespace-nowrap ${shape === 'pill' ? 'rounded-full' : 'rounded-xl'} transition-colors disabled:opacity-50 ${SIZES[size]} ${VARIANTS[variant]} ${className}`;
}

/** A pill tab (filters, form tabs): raised when active. Also used by links (NavLink). */
export const tabClass = (active: boolean) =>
  `inline-flex h-11 flex-none items-center gap-2 rounded-full px-4 text-[15px] font-medium whitespace-nowrap ${
    active ? 'bg-surface text-text shadow-panel' : 'text-text-2 hover:text-text'
  }`;
