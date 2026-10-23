const VARIANTS = {
  primary: 'bg-primary text-on-primary hover:bg-primary-hover font-semibold',
  outline:
    'bg-surface text-text font-medium shadow-[inset_0_0_0_1px_var(--line-2)] hover:shadow-[inset_0_0_0_1px_var(--line-3)]',
  danger: 'bg-transparent text-danger font-medium hover:bg-danger-tint',
} as const;

const SIZES = {
  md: 'h-11 px-5 text-[15px]',
  /** Main action of a form (login, sign-up). */
  lg: 'h-14 px-6 text-base',
} as const;

export type ButtonVariant = keyof typeof VARIANTS;
export type ButtonSize = keyof typeof SIZES;

/** Shared pill button styles; also used by links that look like buttons. */
export function buttonClass(
  variant: ButtonVariant = 'primary',
  className = '',
  size: ButtonSize = 'md',
) {
  return `inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full transition-colors disabled:opacity-50 ${SIZES[size]} ${VARIANTS[variant]} ${className}`;
}
