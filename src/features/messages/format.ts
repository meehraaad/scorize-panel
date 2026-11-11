import { ApiError } from '@/lib/api/client';

/** Django's own words for an invalid field (`{"text": ["…"]}`), if it sent any. */
export function fieldError(error: unknown, field: string): string | undefined {
  if (!(error instanceof ApiError) || error.status !== 400) return undefined;
  const value = (error.body as Record<string, unknown> | null)?.[field];
  return Array.isArray(value) && typeof value[0] === 'string' ? value[0] : undefined;
}
