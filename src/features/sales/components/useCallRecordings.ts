import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { SALES_API, SALES_KEY } from '@/lib/sales/api';

export interface CallRecording {
  id: string;
  at: string;
  duration: number;
}

export function recordingsPath(customer: number) {
  return `${SALES_API}/customers/${customer}/recordings/`;
}

export function useCallRecordings(customer: number, enabled: boolean) {
  return useQuery({
    queryKey: [...SALES_KEY, 'call-recordings', customer],
    queryFn: ({ signal }) => api<{ results: CallRecording[] }>(recordingsPath(customer), { signal }),
    enabled,
    retry: false,
  });
}
