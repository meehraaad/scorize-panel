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
  /** Linphone's setup link for the QR. It expires after 10 minutes, so a ready card refreshes it. */
  linphone: string | null;
}

/** The seller's own mobile login. The office worker makes it within seconds, so pending polls. */
export const mobileExtensionQuery = queryOptions({
  queryKey: [...SALES_KEY, 'mobile-extension'],
  queryFn: ({ signal }) => api<MobileExtensionState>(`${SALES_API}/calls/mobile/`, { signal }),
  refetchInterval: (query) => {
    const status = query.state.data?.status;
    return status === 'pending' ? 3000 : status === 'ready' ? 5 * 60_000 : false;
  },
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

export type Weekday = 'sat' | 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri';
/** Saturday first, like the Persian week. */
export const WEEKDAYS: readonly Weekday[] = ['sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri'];

/** One weekday's opening, Tehran time (`HH:MM`); closing is later the same day. */
export interface OpenHours {
  day: Weekday;
  open: string;
  close: string;
}

/** Today's hand switch: '' follows the hours; it ends at midnight. */
export type LineForce = '' | 'open' | 'closed';

export interface OfficeHoursInput {
  /** When customers reach the main menu; a missing day is closed. */
  week: OpenHours[];
  /** When a caller may dial a person's number from the menu. */
  direct: OpenHours[];
  /** `YYYY-MM-DD`: the line is closed all day. */
  closed_days: string[];
  force: LineForce;
}

export interface OfficeHoursState extends OfficeHoursInput {
  /** False until a manager saves once: the PBX still runs its own hours, shown here. */
  saved: boolean;
  open_now: boolean;
  updated_at: string | null;
  updated_by: string | null;
}

/** The office line's hours (sales managers only), applied to the PBX by the office worker. */
export const officeHoursQuery = queryOptions({
  queryKey: [...SALES_KEY, 'office-hours'],
  queryFn: ({ signal }) => api<OfficeHoursState>(`${SALES_API}/calls/hours/`, { signal }),
});

export function useSaveOfficeHours() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: OfficeHoursInput) =>
      api<OfficeHoursState>(`${SALES_API}/calls/hours/`, { method: 'PUT', body }),
    onSuccess: (data) => client.setQueryData(officeHoursQuery.queryKey, data),
  });
}

/** Someone who can ring in a team: they have a desk phone or a working mobile extension. */
export interface TeamPerson {
  id: number;
  name: string;
  desk: string | null;
  mobile: string | null;
}

/** A team the office line rings (a PBX queue, `number` 1000-1099). */
export interface PhoneTeam {
  number: string;
  name: string;
  /** False: what the PBX has, not managed from the panel yet. */
  saved: boolean;
  /** TeamPerson ids. */
  members: number[];
  /** `09xxxxxxxxx`. */
  outside_numbers: string[];
  /** Extensions on the PBX's team that are no one's; saving drops them. */
  unknown: string[];
  /** Extensions logged in with the queue login code: left as they are. */
  dynamic: string[];
}

export interface PhoneTeams {
  teams: PhoneTeam[];
  people: TeamPerson[];
  /** When the office worker last reported the PBX; null: never. */
  seen_at: string | null;
}

export interface PhoneTeamInput {
  name: string;
  members: number[];
  outside_numbers: string[];
}

export const phoneTeamsQuery = queryOptions({
  queryKey: [...SALES_KEY, 'phone-teams'],
  queryFn: ({ signal }) => api<PhoneTeams>(`${SALES_API}/calls/teams/`, { signal }),
});

/** Saves a team (`number`), or adds one with the next free number. */
export function useSavePhoneTeam() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ number, ...body }: PhoneTeamInput & { number?: string }) =>
      api<PhoneTeams>(
        number === undefined ? `${SALES_API}/calls/teams/` : `${SALES_API}/calls/teams/${number}/`,
        { method: number === undefined ? 'POST' : 'PUT', body },
      ),
    onSuccess: (data) => client.setQueryData(phoneTeamsQuery.queryKey, data),
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
