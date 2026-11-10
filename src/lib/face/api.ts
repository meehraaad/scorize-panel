import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { api } from '@/lib/api/client';

/**
 * A customer's picture (S66): an emoji and a color in place of the name's first letter. Any staff
 * member who can open the customer sets it, from the sales customer page or the supervisor's case,
 * and everyone sees the same one. Each panel has its own address for it
 * (`/sales/v1/customers/<user>/face/`, `/supervisor/v1/cases/<case>/face/`).
 */
export const FACE_COLORS = [
  'plum',
  'rose',
  'orange',
  'yellow',
  'green',
  'teal',
  'blue',
  'gray',
] as const;
export type FaceColor = (typeof FACE_COLORS)[number];

export interface Face {
  /** '' : the first letter. */
  emoji: string;
  /** '' : the brand's plum. */
  color: FaceColor | '';
}

/** Token classes per color (tokens.css `--face-*`, light and dark). */
export const FACE_FILL: Record<FaceColor, string> = {
  plum: 'bg-face-plum',
  rose: 'bg-face-rose',
  orange: 'bg-face-orange',
  yellow: 'bg-face-yellow',
  green: 'bg-face-green',
  teal: 'bg-face-teal',
  blue: 'bg-face-blue',
  gray: 'bg-face-gray',
};

/** What a seller picks from: moods, fun faces, animals, goals, study and things. */
// prettier-ignore
export const FACE_EMOJIS = [
  '🙂', '😊', '😎', '🤓', '🧐', '🤩', '🥳', '😇', '🤔', '😌', '😅', '😴',
  '🦊', '🐼', '🦁', '🐯', '🐨', '🐸', '🦉', '🐬', '🐝', '🦄', '🐢', '🐧',
  '🎓', '📚', '✈️', '🌍', '🚀', '🎯', '💼', '🏆', '💎', '🔥', '⭐', '❤️',
  '🌱', '🍀', '🌸', '🌻', '☕', '🎨', '🎵', '⚽', '💰', '⏰', '🧩', '👑',
  '💩', '🤡', '👻', '👽', '🤖', '🤠', '🥸', '🤑', '🤯', '🥶', '🥵', '🤪',
  '😈', '🙈', '🫠', '😬', '🙄', '😤', '😭', '🥺', '🤐', '🤫', '🫡', '🤗',
  '🐶', '🐱', '🐵', '🐷', '🐮', '🐔', '🦖', '🐙', '🦋', '🐌', '🦀', '🐳',
  '🍕', '🍔', '🍩', '🍉', '🌶️', '🥑', '🎁', '🎈', '💡', '📌', '⚠️', '❓',
] as const;

/** Saves the face and puts it on the page's data (`queryKey`: the customer or the case). */
export function useSetFace(url: string, queryKey: QueryKey) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (face: Face) =>
      api<{ face: Face | null }>(url, { method: 'PUT', body: face }).then((data) => data.face),
    onSuccess: (face) =>
      client.setQueryData<{ face?: Face | null } | null>(queryKey, (data) =>
        data ? { ...data, face } : data,
      ),
  });
}
