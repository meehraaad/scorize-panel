import { isRouteErrorResponse } from 'react-router';
import { ApiError } from '@/lib/api/client';

/** What was not found: a page, or an account that is no longer active (the API's `code: inactive`). */
export type Missing = 'page' | 'inactive' | null;

export function missingOf(error: unknown): Missing {
  if (isRouteErrorResponse(error)) return error.status === 404 ? 'page' : null;
  // A page's own data answered 404 (e.g. an inactive customer, customer 63437): not a network
  // problem, so "check your connection and retry" would be wrong.
  if (!(error instanceof ApiError) || error.status !== 404) return null;
  const { body } = error;
  return body && typeof body === 'object' && 'code' in body && body.code === 'inactive'
    ? 'inactive'
    : 'page';
}
