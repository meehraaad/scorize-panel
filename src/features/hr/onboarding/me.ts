import { queryOptions } from '@tanstack/react-query';
import { ApiError, api } from '@/lib/api/client';
import { HR_API } from '../api';
import type { Onboarding } from './api';

/**
 * The new hire's own form (`/me/onboarding`'s route data). Apart from `./api` because the router
 * imports it: a module shared with the first load comes with it whole.
 */
export const MY_ONBOARDING_API = `${HR_API}/me/onboarding/`;
export const myOnboardingFilesPath = `${MY_ONBOARDING_API}files/`;

/** A 404 means "no form": the page says so instead of failing. */
export async function orNull<T>(request: Promise<T>): Promise<T | null> {
  try {
    return await request;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

/** The logged-in hire's open form (or one approved lately), null when there is none. */
export const myOnboardingQuery = queryOptions({
  queryKey: ['me', 'onboarding'],
  queryFn: ({ signal }) => orNull(api<Onboarding>(MY_ONBOARDING_API, { signal })),
});
