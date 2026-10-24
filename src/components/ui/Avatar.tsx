import { initialOf } from '@/lib/text';

const SIZES = { sm: 'size-9 text-sm', md: 'size-10 text-base' } as const;
const TONES = { tint: 'bg-tint text-primary-text', hero: 'bg-hero text-on-hero' } as const;

/**
 * A person's first letter in a circle (no photos yet). Decorative: the name is always shown beside it.
 * `stacked`: overlaps the avatar before it, with a ring in the card colour (a group of people).
 */
export function Avatar({
  name,
  size = 'md',
  tone = 'tint',
  stacked = false,
}: {
  name: string;
  size?: keyof typeof SIZES;
  tone?: keyof typeof TONES;
  stacked?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={`flex flex-none items-center justify-center rounded-full font-bold ${SIZES[size]} ${TONES[tone]} ${
        stacked ? 'shadow-[0_0_0_3px_var(--surface)] not-first:-ms-2.5' : ''
      }`}
    >
      {initialOf(name)}
    </span>
  );
}
