import { http, HttpResponse } from 'msw';

/** Fake `POST /api/metrics/v1/errors/` (scorize api/metrics/v1/client_errors.py): answers the code. */
export const MOCK_CRASH_CODE = 'c0ffee00c0ffee00c0ffee00c0ffee00';

export const clientErrorHandlers = [
  http.post('/api/metrics/v1/errors/', () =>
    HttpResponse.json({ code: MOCK_CRASH_CODE }, { status: 201 }),
  ),
];
