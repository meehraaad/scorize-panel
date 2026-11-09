import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';

/**
 * The customer's shared notebook (S61): one list of notes that sales, supervisors and managers all
 * read and write, each with its author, role and time. Each panel reaches it by its own address
 * (`/sales/v1/customers/<user>/notes/`, `/supervisor/v1/cases/<case>/notebook/`); the rows are the same.
 */
export type NoteAbout = 'customer' | 'contract';
export type NoteRole = 'sales' | 'supervisor' | 'manager' | 'staff';
/** Which old single-text note it was moved in from. */
export type NoteImported = 'crm' | 'supervisor' | 'manager';

export interface Note {
  id: number;
  text: string;
  about: NoteAbout;
  role: NoteRole;
  pinned: boolean;
  /** null for a moved-in old note, or a removed staff member. */
  author: string | null;
  imported: NoteImported | null;
  created_at: string;
  edited_at: string | null;
  /** Written by the viewer: only they change its text. */
  mine: boolean;
}

export const NOTE_ABOUTS: readonly NoteAbout[] = ['customer', 'contract'];

export const notebookKey = (url: string) => ['notebook', url] as const;

/** `url`: the notebook's address in this panel, ending in a slash. */
export const notebookQuery = (url: string) =>
  queryOptions({
    queryKey: notebookKey(url),
    queryFn: ({ signal }) => api<{ results: Note[] }>(url, { signal }),
    select: (data) => data.results,
  });

export function useAddNote(url: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: { text: string; about: NoteAbout }) =>
      api<Note>(url, { method: 'POST', body }),
    onSuccess: () => client.invalidateQueries({ queryKey: notebookKey(url) }),
  });
}

export function useChangeNote(url: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...body
    }: {
      id: number;
      text?: string;
      about?: NoteAbout;
      pinned?: boolean;
    }) => api<Note>(`${url}${String(id)}/`, { method: 'PATCH', body }),
    onSuccess: () => client.invalidateQueries({ queryKey: notebookKey(url) }),
  });
}
