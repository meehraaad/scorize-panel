const VARIANTS = {
  primary: 'bg-primary text-on-primary hover:bg-primary-hover font-semibold',
  outline:
    'bg-surface text-text font-medium shadow-[inset_0_0_0_1px_var(--line-2)] hover:shadow-[inset_0_0_0_1px_var(--line-3)]',
  danger: 'bg-transparent text-danger font-medium hover:bg-danger-tint',
} as const;

export type ButtonVariant = keyof typeof VARIANTS;

/** Shared pill button styles; also used by links that look like buttons. */
export function buttonClass(variant: ButtonVariant = 'primary', className = '') {
  return `inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-full px-5 text-[15px] transition-colors disabled:opacity-50 ${VARIANTS[variant]} ${className}`;
}
