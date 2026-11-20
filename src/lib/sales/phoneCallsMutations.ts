import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { uploadFile, type UploadMessages } from '@/lib/upload';
import { SALES_API, SALES_KEY } from './api';
import {
  officeExtensionQuery,
  type MobileExtensionState,
  mobileExtensionQuery,
  type OfficeHoursInput,
  type OfficeHoursState,
  officeHoursQuery,
  type PhoneTeams,
  type PhoneTeamInput,
  phoneTeamsQuery,
  type PhoneExtensions,
  phoneExtensionsQuery,
  type MenuKey,
  type PhoneMenus,
  phoneMenusQuery,
  type PhoneVoices,
  phoneVoicesQuery,
  type PhoneBreakState,
  phoneBreakQuery,
} from './phoneCalls';

/**
 * The mutations of `./phoneCalls`, apart from its queries: the routes' page data imports those, so
 * this code stays out of the first load and comes with the pages that change something.
 */
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

export function useSaveOfficeHours() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: OfficeHoursInput) =>
      api<OfficeHoursState>(`${SALES_API}/calls/hours/`, { method: 'PUT', body }),
    onSuccess: (data) => client.setQueryData(officeHoursQuery.queryKey, data),
  });
}

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

/** Links a desk phone to someone (null unlinks); 409 `extension_taken` when another person has it. */
export function useSetStaffDesk() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, desk }: { id: number; desk: string | null }) =>
      api<PhoneExtensions>(`${SALES_API}/calls/extensions/${id}/desk/`, {
        method: 'PUT',
        body: { desk },
      }),
    onSuccess: (data) => {
      client.setQueryData(phoneExtensionsQuery.queryKey, data);
      // Teams show people by their phones.
      void client.invalidateQueries({ queryKey: phoneTeamsQuery.queryKey });
    },
  });
}

/** Makes or removes someone's mobile extension (409 `removing` while the old one is going). */
export function useSetStaffMobile() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: number; action: 'create' | 'remove' }) =>
      api<PhoneExtensions>(`${SALES_API}/calls/extensions/${id}/mobile/`, {
        method: 'POST',
        body: { action },
      }),
    onSuccess: (data) => {
      client.setQueryData(phoneExtensionsQuery.queryKey, data);
      void client.invalidateQueries({ queryKey: phoneTeamsQuery.queryKey });
    },
  });
}

export function useSavePhoneMenu() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, keys }: { id: string; keys: MenuKey[] }) =>
      api<PhoneMenus>(`${SALES_API}/calls/menus/${id}/`, { method: 'PUT', body: { keys } }),
    onSuccess: (data) => client.setQueryData(phoneMenusQuery.queryKey, data),
  });
}

/** A new greeting file for one recording: MP3, WAV, M4A or OGG, up to 10 MB. */
export function useUploadVoice(recording: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ file, messages }: { file: File; messages?: UploadMessages }) => {
      const body = new FormData();
      body.append('file', file);
      return uploadFile<PhoneVoices>(
        `${SALES_API}/calls/voices/${recording}/`,
        body,
        file,
        messages,
      );
    },
    onSuccess: (data) => client.setQueryData(phoneVoicesQuery.queryKey, data),
  });
}

export function useSetPhoneBreak() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (onBreak: boolean) =>
      api<PhoneBreakState>(`${SALES_API}/calls/break/`, {
        method: 'PUT',
        body: { on_break: onBreak },
      }),
    onSuccess: (data) => client.setQueryData(phoneBreakQuery.queryKey, data),
  });
}
