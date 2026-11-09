import { HttpResponse } from 'msw';
import { FACE_COLORS, type Face } from '@/lib/face/api';

/**
 * The customer's emoji and color (S66), as Django keeps it on `UserInfo`: one per user that the
 * sales and supervisor mocks both read and write (`api/core/face.py`).
 */
const faces = new Map<number, Face>();

export const faceOf = (user: number): Face | null => faces.get(user) ?? null;

/** PUT `{emoji, color}` → `{face}`: both '' clears it (`face: null`), like Django. */
export async function putFace(user: number, request: Request) {
  const body = (await request.json()) as Partial<Face>;
  const emoji = (body.emoji ?? '').trim();
  const color = body.color ?? '';
  if (color && !(FACE_COLORS as readonly string[]).includes(color))
    return HttpResponse.json({ color: [`"${color}" is not a valid choice.`] }, { status: 400 });
  if (/[\p{L}\s]/u.test(emoji))
    return HttpResponse.json({ emoji: ['Choose an emoji.'] }, { status: 400 });
  if (!emoji && !color) {
    faces.delete(user);
    return HttpResponse.json({ face: null });
  }
  const face: Face = { emoji, color };
  faces.set(user, face);
  return HttpResponse.json({ face });
}

/** Between tests. */
export function resetFaces() {
  faces.clear();
}
