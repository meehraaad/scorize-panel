import { useMutation, useQueryClient } from '@tanstack/react-query';
import { API_BASE, api } from '@/lib/api/client';
import { ATTENDANCE_API, ATTENDANCE_KEY, paramsOf, type Enrollment, type Range } from './api';

/** The report as a file (Excel: the daily and the summary sheet; CSV: the daily one). */
export const exportHref = (range: Range, file: 'xlsx' | 'csv') =>
  `${API_BASE}${ATTENDANCE_API}/export/?${paramsOf(range)}&file=${file}`;

/** Map a terminal number to a staff member (null: unmap it). */
export function useMapEnrollment() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, employee }: { id: number; employee: number | null }) =>
      api<Enrollment>(`${ATTENDANCE_API}/enrollments/${String(id)}/`, {
        method: 'PATCH',
        body: { employee },
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: ATTENDANCE_KEY }),
  });
}

/** Ask the terminal for its users' names over its next connection. */
export function useReadNames() {
  return useMutation({
    mutationFn: () =>
      api<{ id: number; status: string }>(`${ATTENDANCE_API}/sync/`, { method: 'POST' }),
  });
}
