import { HttpResponse } from 'msw';

const SESSION_KEY = 'scorize.mock.session';

/** Who is logged in to the fake Django (Django keeps this in the session cookie). */
export const storage = {
  get: () => Number(globalThis.localStorage.getItem(SESSION_KEY)) || null,
  set: (id: number | null) => {
    if (id) globalThis.localStorage.setItem(SESSION_KEY, String(id));
    else globalThis.localStorage.removeItem(SESSION_KEY);
  },
};

/** DRF's answers for "not logged in" and "nothing here". */
export const forbidden = () =>
  HttpResponse.json({ detail: 'Authentication credentials were not provided.' }, { status: 403 });
export const notFound = () => HttpResponse.json({ detail: 'Not found.' }, { status: 404 });
