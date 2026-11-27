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
  /** The label shown under it on hover and focus (the `tip` utility): its aria-label unless given;
   *  `''` for none (where the icon's meaning is plain, e.g. a dialog's close). */
  tip?: string;
}

/** `inherit`: the colour of the text around it (on the dark hero). */
const TONES = {
  default: 'text-text hover:bg-canvas disabled:opacity-50',
  danger: 'text-danger hover:bg-canvas disabled:opacity-50',
  muted: 'text-text-2 hover:bg-canvas disabled:opacity-50',
  inherit: 'hover:bg-canvas disabled:opacity-50',
  /** Chat apps' logos, in their brand colour. */
  whatsapp: 'text-brand-whatsapp hover:bg-canvas disabled:opacity-50',
  telegram: 'text-brand-telegram hover:bg-canvas disabled:opacity-50',
  /** Just done (copied): a check on green for a moment. */
  done: 'bg-good-tint text-good',
  /** Filled: the main action of a small composer (send a note). Grey while it can't be used. */
  primary:
    'bg-primary text-on-primary transition-colors hover:bg-primary-hover disabled:bg-track disabled:text-text-2',
} as const;

/** Round icon-only button with a 44px touch target (edit, delete, remove, close). */
export function IconButton({
  icon,
  tone = 'default',
  iconSize = 20,
  shape = 'round',
  className = '',
  type = 'button',
  tip: givenTip,
  ...props
}: IconButtonProps) {
  const tip = givenTip ?? props['aria-label'];
  return (
    <button
      type={type}
      data-tip={tip || undefined}
      className={`flex size-11 flex-none items-center justify-center transition-colors ${shape === 'round' ? 'rounded-full' : 'rounded-xl'} ${tip ? 'tip' : ''} ${TONES[tone]} ${className}`}
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
  tip: givenTip,
  ...props
}: Omit<ComponentProps<'a'>, 'children'> & {
  icon: IconName;
  'aria-label': string;
  tone?: keyof typeof TONES;
  iconSize?: number;
  shape?: 'round' | 'rounded';
  /** As on `IconButton`: its aria-label unless given, `''` for none. */
  tip?: string;
}) {
  const tip = givenTip ?? props['aria-label'];
  return (
    <a
      data-tip={tip || undefined}
      className={`flex size-11 flex-none items-center justify-center rounded-full transition-colors ${tip ? 'tip' : ''} ${TONES[tone]} ${className}`}
      href={safeHref(href)}
      {...props}
    >
      <Icon name={icon} size={iconSize} />
    </a>
  );
}
