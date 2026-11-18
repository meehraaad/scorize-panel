import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { APPLICANT_KEY } from '@/lib/applicant/approval';
import { type GpaCourse, BASE } from './api';

/**
 * The mutations of `./api`, apart from its queries: the routes' page data imports those, so
 * this code stays out of the first load and comes with the pages that change something.
 */
/**
 * Registers for a webinar. Free: registered at once (`payment_id` null). Paid: an invoice to pay
 * on the payment page.
 */
export function useRegisterWebinar() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      api<{ payment_id: number | null }>(`${BASE}/webinars/${String(id)}/register/`, {
        method: 'POST',
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: APPLICANT_KEY }),
  });
}

/** Saves the courses; the server computes the GPA (the method universities use, out of 4). */
export function useSaveGpa() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (courses: GpaCourse[]) =>
      api<{ result: number }>(`${BASE}/gpa/`, { method: 'PUT', body: { courses } }),
    onSuccess: () => client.invalidateQueries({ queryKey: [...APPLICANT_KEY, 'services'] }),
  });
}

export function useReviewPackage(id: number) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (text: string) =>
      api(`${BASE}/packages/${String(id)}/review/`, { method: 'POST', body: { text } }),
    onSuccess: () => client.invalidateQueries({ queryKey: [...APPLICANT_KEY, 'services'] }),
  });
}
