import { isRouteErrorResponse } from 'react-router';
import { ApiError } from '@/lib/api/client';

/** What was not found: a page, or an account that is no longer active (the API's `code: inactive`). */
export type Missing = 'page' | 'inactive' | null;

/**
 * The code support can look up (the request's ID in the server's logs), for a failure on the server's side only:
 * a network problem never reached the server and a 4xx is about the request, so neither gets one.
 */
export function supportCodeOf(error: unknown): string | null {
  return error instanceof ApiError && error.status >= 500 ? error.requestId : null;
}

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
