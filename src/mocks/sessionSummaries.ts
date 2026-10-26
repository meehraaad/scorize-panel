import { http, HttpResponse } from 'msw';
import type { SessionSummary } from '@/features/consultations/api';
import { forbidden, storage } from './session';

const summaries = new Map<number, SessionSummary[]>();

export function saveSessionSummary(customer: number, summary: SessionSummary) {
  summaries.set(customer, [...(summaries.get(customer) ?? []), summary]);
}

export function summaryForContact(customer: number, id: string) {
  return summaries.get(customer)?.find((row) => id === `contact-${String(row.id)}`)
    ?.customer_summary;
}

export function resetSessionSummaries() {
  summaries.clear();
}

export const sessionSummaryHandlers = [
  http.get('/api/applicant/v1/session-summaries/', ({ request }) => {
    const user = storage.get();
    if (!user) return forbidden();
    const params = new URL(request.url).searchParams;
    const before = params.get('before');
    const reservation = params.get('reservation');
    if (reservation !== null && !/^\d+$/.test(reservation))
      return HttpResponse.json({ reservation: ['A booking id is required.'] }, { status: 400 });
    if (before !== null && !/^\d+$/.test(before))
      return HttpResponse.json({ before: ['A row id is required.'] }, { status: 400 });
    const rows = (summaries.get(user) ?? [])
      .filter(
        (row) =>
          (!before || row.id < Number(before)) &&
          (!reservation || row.reservation === Number(reservation)),
      )
      .sort((a, b) => b.id - a.id);
    return HttpResponse.json({ results: rows.slice(0, 20), has_more: rows.length > 20 });
  }),
];
