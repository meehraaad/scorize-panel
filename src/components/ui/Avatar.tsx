import { FACE_FILL, type Face } from '@/lib/face/api';
import { initialOf } from '@/lib/text';

const SIZES = { xs: 'size-6 text-[11px]', sm: 'size-9 text-sm', md: 'size-10 text-base' } as const;
const TONES = {
  tint: 'bg-tint text-primary-text',
  hero: 'bg-hero text-on-hero',
  primary: 'bg-primary text-on-primary',
} as const;

/**
 * A person's first letter in a circle (no photos yet), or their chosen face (emoji and colour)
 * when they set one. Decorative: the name is always shown beside it.
 * `stacked`: overlaps the avatar before it, with a ring in the card colour (a group of people).
 */
export function Avatar({
  name,
  face = null,
  size = 'md',
  tone = 'tint',
  shape = 'circle',
  stacked = false,
}: {
  name: string;
  face?: Face | null;
  size?: keyof typeof SIZES;
  tone?: keyof typeof TONES;
  shape?: 'circle' | 'rounded';
  stacked?: boolean;
}) {
  const fill = face?.color ? `${FACE_FILL[face.color]} text-text` : TONES[tone];
  return (
    <span
      aria-hidden="true"
      className={`flex flex-none items-center justify-center font-bold ${shape === 'rounded' ? 'rounded-xl' : 'rounded-full'} ${SIZES[size]} ${fill} ${
        stacked ? 'shadow-[0_0_0_3px_var(--surface)] not-first:-ms-2.5' : ''
      }`}
    >
      {face?.emoji ? (
        <span className="text-[1.25em] leading-none">{face.emoji}</span>
      ) : (
        initialOf(name)
      )}
    </span>
  );
}
