import type { ComponentProps } from 'react';
import { safeHref } from '@/lib/url';
import { Icon, type IconName } from './Icon';

interface IconButtonProps extends Omit<ComponentProps<'button'>, 'children'> {
  icon: IconName;
  /** Required: an icon alone has no name for screen readers. */
  'aria-label': string;
  tone?: keyof typeof TONES;
  iconSize?: number;
  shape?: 'round' | 'rounded';
}

/** `inherit`: the colour of the text around it (on the dark hero). */
const TONES = {
  default: 'text-text',
  danger: 'text-danger',
  muted: 'text-text-2',
  inherit: '',
} as const;

/** Round icon-only button with a 44px touch target (edit, delete, remove, close). */
export function IconButton({
  icon,
  tone = 'default',
  iconSize = 20,
  shape = 'round',
  className = '',
  type = 'button',
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      className={`flex size-11 flex-none items-center justify-center ${shape === 'round' ? 'rounded-full' : 'rounded-xl'} hover:bg-canvas disabled:opacity-50 ${TONES[tone]} ${className}`}
      {...props}
    >
      <Icon name={icon} size={iconSize} />
    </button>
  );
}

/** The same look for a link (download). */
export function IconLink({
  icon,
  tone = 'default',
  iconSize = 20,
  className = '',
  href,
  ...props
}: Omit<ComponentProps<'a'>, 'children'> & {
  icon: IconName;
  'aria-label': string;
  tone?: keyof typeof TONES;
  iconSize?: number;
  shape?: 'round' | 'rounded';
}) {
  return (
    <a
      className={`flex size-11 flex-none items-center justify-center rounded-full hover:bg-canvas ${TONES[tone]} ${className}`}
      href={safeHref(href)}
      {...props}
    >
      <Icon name={icon} size={iconSize} />
    </a>
  );
}
