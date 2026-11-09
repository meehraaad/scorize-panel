import { FACE_FILL, type Face } from '@/lib/face/api';
import { initialOf } from '@/lib/text';

/**
 * The customer's emoji and color (S66) beside their name in a list (leads, board, tasks, calendar).
 * Nothing when the team hasn't set one, so the lists look as before. Decorative: the name is beside it.
 */
export function FaceDot({
  name,
  face,
  size = 'md',
}: {
  name: string;
  face?: Face | null | undefined;
  size?: 'sm' | 'md';
}) {
  if (!face) return null;
  return (
    <span
      aria-hidden="true"
      className={`inline-flex flex-none items-center justify-center rounded-full font-bold text-text ${
        size === 'sm' ? 'size-5 text-[11px]' : 'size-7 text-sm'
      } ${face.color ? FACE_FILL[face.color] : 'bg-tint'}`}
    >
      {face.emoji ? (
        <span className={size === 'sm' ? 'text-[12px] leading-none' : 'text-[16px] leading-none'}>
          {face.emoji}
        </span>
      ) : (
        initialOf(name)
      )}
    </span>
  );
}
