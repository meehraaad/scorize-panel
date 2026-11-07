import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api/client';
import { SALES_API, SALES_KEY } from './api';

export interface PhoneCall {
  id: string;
  extension: string;
  phone: string;
  direction: 'inbound' | 'outbound';
  status: 'ringing' | 'connected' | 'ended' | 'missed' | 'cancelled';
  started_at: string;
  answered_at: string | null;
  ended_at: string | null;
  customer: { id: number; name: string } | null;
}

export interface ObservedCall extends PhoneCall {
  clockOffsetMs: number;
  connected: boolean;
}

export interface PhoneSnapshot {
  /** Live calls are on for this seller; `extension` may still be null until they pick their desk phone. */
  available: boolean;
  enabled: boolean;
  connected: boolean;
  extension: string | null;
  server_time: string;
  calls: PhoneCall[];
}

export const isActiveCall = (call: PhoneCall) => call.ended_at === null;

export const phoneCallsQuery = (owner: number) =>
  queryOptions({
    queryKey: [...SALES_KEY, 'phone-calls', owner],
    queryFn: ({ signal }) => api<PhoneSnapshot>(`${SALES_API}/calls/`, { signal }),
    staleTime: 0,
    refetchInterval: (query) => {
      const error = query.state.error;
      if (error instanceof ApiError && [401, 403, 404].includes(error.status)) return false;
      return query.state.data?.enabled === false ? 60_000 : 2000;
    },
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
    retry: false,
  });

/**
 * The seller's own desk phone on the office PBX. Not the PortSIP `internal_number` from staff admin:
 * the two are different phone systems.
 */
export const officeExtensionQuery = queryOptions({
  queryKey: [...SALES_KEY, 'office-extension'],
  queryFn: ({ signal }) =>
    api<{ extension: string | null }>(`${SALES_API}/calls/extension/`, { signal }),
});

export function useSetOfficeExtension() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (extension: string | null) =>
      api<{ extension: string | null }>(`${SALES_API}/calls/extension/`, {
        method: 'PUT',
        body: { extension },
      }),
    onSuccess: (data) => {
      client.setQueryData(officeExtensionQuery.queryKey, data);
      return client.invalidateQueries({ queryKey: [...SALES_KEY, 'phone-calls'] });
    },
  });
}

export interface MobileExtensionState {
  /** The server offers mobile extensions; otherwise the settings card stays hidden. */
  available: boolean;
  status: 'none' | 'pending' | 'ready' | 'failed';
  extension: string | null;
  password: string | null;
  domain: string | null;
  server: string | null;
}

/** The seller's own PortSIP login. The office worker makes it within seconds, so pending polls. */
export const mobileExtensionQuery = queryOptions({
  queryKey: [...SALES_KEY, 'mobile-extension'],
  queryFn: ({ signal }) => api<MobileExtensionState>(`${SALES_API}/calls/mobile/`, { signal }),
  refetchInterval: (query) => (query.state.data?.status === 'pending' ? 3000 : false),
});

export function useRequestMobileExtension() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (reset: boolean) =>
      api<MobileExtensionState>(`${SALES_API}/calls/mobile/`, {
        method: 'POST',
        body: { reset },
      }),
    onSuccess: (data) => client.setQueryData(mobileExtensionQuery.queryKey, data),
  });
}

/** Server timestamps, rather than counting interval ticks, survive navigation and tab throttling. */
export function callSeconds(call: ObservedCall, now: number) {
  const start = Date.parse(call.answered_at ?? call.started_at);
  const end = call.ended_at ? Date.parse(call.ended_at) : now + call.clockOffsetMs;
  return Number.isFinite(start) && Number.isFinite(end)
    ? Math.max(0, Math.floor((end - start) / 1000))
    : 0;
}

export function callDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}
