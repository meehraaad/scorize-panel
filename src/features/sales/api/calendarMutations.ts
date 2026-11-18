import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { SALES_API, SALES_KEY } from '@/lib/sales/api';
import { type SellerCalendar, CALENDAR_KEY, type FollowUpChange } from './calendar';

/**
 * The mutations of `./calendar`, apart from its queries: the routes' page data imports those, so
 * this code stays out of the first load and comes with the pages that change something.
 */
/** An in-person customer arrived at the office (S47). */
export function useMarkArrived() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      api<{ arrived_at: string }>(`${SALES_API}/consultations/${String(id)}/arrived/`, {
        method: 'POST',
      }),
    onSettled: () => client.invalidateQueries({ queryKey: CALENDAR_KEY }),
  });
}

/**
 * A sales manager gives a paid consultation to a seller, or to nobody (`staff: null`). The
 * calendars, the consultations list and Today reload after.
 */
export function useAssignConsultation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, staff }: { id: number; staff: number | null }) =>
      api<{ seller_id: number | null; seller: string | null }>(
        `${SALES_API}/consultations/${String(id)}/assign/`,
        { method: 'POST', body: { staff } },
      ),
    onSettled: () => client.invalidateQueries({ queryKey: SALES_KEY }),
  });
}

/**
 * Sets a lead's one follow-up from the calendar (a new one, or one dragged to another time) through
 * `leads/bulk/`. A moved call jumps there at once; the calendars and lists reload after.
 */
export function useSetFollowUp() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ lead, at, on, text, minutes }: FollowUpChange) =>
      api(`${SALES_API}/leads/bulk/`, {
        method: 'POST',
        body: {
          ids: [lead],
          ...(on ? { follow_up_on: on } : { follow_up_at: at }),
          ...(text ? { follow_up_text: text } : {}),
          ...(minutes ? { follow_up_minutes: minutes } : {}),
        },
      }),
    onMutate: async ({ lead, at, on, minutes }) => {
      // A day with no hour is due by its end (Django's 23:59), on the day row.
      const due = on ? new Date(`${on}T23:59`).toISOString() : at;
      await client.cancelQueries({ queryKey: CALENDAR_KEY });
      const before = client.getQueriesData<SellerCalendar>({ queryKey: CALENDAR_KEY });
      client.setQueriesData<SellerCalendar>(
        { queryKey: CALENDAR_KEY },
        (data) =>
          data && {
            ...data,
            calls: data.calls.map((call) =>
              call.lead === lead && due
                ? { ...call, follow_up_at: due, timed: !on, ...(minutes ? { minutes } : {}) }
                : call,
            ),
          },
      );
      return { before };
    },
    onError: (_error, _change, context) => {
      for (const [key, data] of context?.before ?? []) client.setQueryData(key, data);
    },
    onSettled: () => client.invalidateQueries({ queryKey: SALES_KEY }),
  });
}
