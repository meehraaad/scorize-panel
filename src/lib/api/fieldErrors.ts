import { ApiError } from './client';

/** A 400's first message per field (`{field: ["…"]}`), for the form to show under each field. */
export function fieldErrors(error: unknown): Record<string, string> {
  if (!(error instanceof ApiError) || error.status !== 400 || !error.body) return {};
  const body = error.body as Record<string, unknown>;
  return Object.fromEntries(
    Object.entries(body).flatMap(([field, value]) =>
      Array.isArray(value) && typeof value[0] === 'string' ? [[field, value[0]]] : [],
    ),
  );
}
