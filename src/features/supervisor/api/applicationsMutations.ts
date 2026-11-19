import { api } from '@/lib/api/client';
import { useSupervisorMutation } from './case';
import { SUPERVISOR_API } from './common';
import type { ApplicationInput, BotSettings, BotSettingsChange } from './applications';

/**
 * The mutations of `./applications`, apart from its queries: the routes' page data imports those, so
 * this code stays out of the first load and comes with the pages that change something.
 */
export function useSaveApplication(id: number) {
  return useSupervisorMutation(
    ({ application, values }: { application: number | null; values: ApplicationInput }) =>
      application === null
        ? api(`${SUPERVISOR_API}/cases/${String(id)}/applications/`, {
            method: 'POST',
            body: values,
          })
        : api(`${SUPERVISOR_API}/cases/${String(id)}/applications/${String(application)}/`, {
            method: 'PATCH',
            body: values,
          }),
  );
}

export function useDeleteApplication(id: number) {
  return useSupervisorMutation((application: number) =>
    api(`${SUPERVISOR_API}/cases/${String(id)}/applications/${String(application)}/`, {
      method: 'DELETE',
    }),
  );
}

export function useSetBot(id: number) {
  return useSupervisorMutation((active: boolean) =>
    api(`${SUPERVISOR_API}/cases/${String(id)}/bot/`, { method: 'POST', body: { active } }),
  );
}

export function useSaveBotSettings(id: number) {
  return useSupervisorMutation((change: BotSettingsChange) =>
    api<BotSettings>(`${SUPERVISOR_API}/cases/${String(id)}/bot/settings/`, {
      method: 'PATCH',
      body: change,
    }),
  );
}
