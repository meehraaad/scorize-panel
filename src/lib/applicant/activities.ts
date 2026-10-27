import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { uploadFile, type UploadMessages } from '@/lib/upload';
import { APPLICANT_KEY } from './approval';

/**
 * Things the applicant must or may do, whoever asks: the supervisor ("send your passport scan"),
 * the seller after a session, a survey, what a purchase leaves (a form), a due instalment. One list,
 * shown in the box on every page (components/applicant/activities). Shapes: docs/backend-changes.md
 * AC1–AC7.
 */

/** How it is done: the first four in the box itself, `form` and `pay` on their own page. */
export type ActivityKind = 'survey' | 'rating' | 'question' | 'upload' | 'form' | 'pay';
export type ActivitySource = 'supervisor' | 'seller' | 'consultant' | 'writer' | 'system';
/** `urgent` opens the box by itself (once a day); `quiet` ones wait in the list. */
export type ActivityLevel = 'blocking' | 'urgent' | 'normal' | 'quiet';

export interface Activity {
  id: number;
  kind: ActivityKind;
  source: ActivitySource;
  /** The person who asked; null for the system's own (a due instalment). */
  from: string | null;
  level: ActivityLevel;
  /** Can be put off ("later") but not dismissed. */
  required: boolean;
  /** Localized by the server (Accept-Language). */
  title: string;
  text: string;
  due_at: string | null;
  /** 0–100 for a form already started. */
  progress: number | null;
  /** `survey`: the choices; `rating`: the top score; `upload`: accepted types; `form`, `pay`: the panel path. */
  payload: {
    choices?: { value: string; label: string }[];
    max?: number;
    accept?: string[];
    href?: string;
  };
}

const BASE = '/applicant/v1/activities';

export const activitiesQuery = queryOptions({
  queryKey: [...APPLICANT_KEY, 'activities'],
  queryFn: async ({ signal }) =>
    (await api<{ results: Activity[] }>(`${BASE}/`, { signal })).results,
  staleTime: 60_000,
});

/** Required first, then urgent, then by due date (none last). */
export function sortActivities(list: readonly Activity[]) {
  const due = (item: Activity) => (item.due_at ? Date.parse(item.due_at) : Infinity);
  return [...list].sort(
    (a, b) =>
      Number(b.required) - Number(a.required) ||
      Number(b.level === 'urgent') - Number(a.level === 'urgent') ||
      due(a) - due(b),
  );
}

function useActivityMutation<T>(mutationFn: (variables: T) => Promise<unknown>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn,
    // An answer can change other pages too (a closed form task, a paid instalment).
    onSuccess: () => client.invalidateQueries({ queryKey: APPLICANT_KEY }),
  });
}

export type ActivityResponse = { choice: string } | { score: number } | { text: string };

export function useRespondActivity() {
  return useActivityMutation(({ id, response }: { id: number; response: ActivityResponse }) =>
    api(`${BASE}/${String(id)}/respond/`, { method: 'POST', body: { response } }),
  );
}

export function useUploadActivity() {
  return useActivityMutation(
    ({ id, file, messages }: { id: number; file: File; messages?: UploadMessages }) => {
      const body = new FormData();
      body.append('file', file);
      return uploadFile(`${BASE}/${String(id)}/respond/`, body, file, messages);
    },
  );
}

/** "Later": out of the list for 24 hours. */
export function useSnoozeActivity() {
  return useActivityMutation((id: number) =>
    api(`${BASE}/${String(id)}/snooze/`, { method: 'POST' }),
  );
}

/** Only for activities that aren't required (409 otherwise). */
export function useDismissActivity() {
  return useActivityMutation((id: number) =>
    api(`${BASE}/${String(id)}/dismiss/`, { method: 'POST' }),
  );
}
