import { useMutation } from '@tanstack/react-query';
import { API_BASE, api } from '@/lib/api/client';
import type { ApplicationResult } from '@/lib/applications';
import { useSupervisorMutation } from './case';
import { SUPERVISOR_API } from './common';

/**
 * Import application results from a CSV (SV17): the server reads the file and answers what each
 * row would change, then applies it when the supervisor confirms. Columns: file, university,
 * program, deadline, result.
 */

/** What a row does: changes a result, adds an application, changes nothing, or is left out. */
export type ImportChange = 'update' | 'add' | 'same' | 'skip';

/** Why a row is left out. */
export type ImportProblem = 'case_not_found' | 'bad_result' | 'bad_date' | 'missing_column';

export interface ImportRow {
  /** Line in the file (the header is line 1). */
  line: number;
  file_number: number | null;
  /** null when the case isn't found or isn't one of the supervisor's. */
  applicant: { id: number; name: string } | null;
  university: string;
  program: string;
  old: ApplicationResult | null;
  new: ApplicationResult | null;
  change: ImportChange;
  problem: ImportProblem | null;
}

export interface ImportPreview {
  /** Hands the checked file to the apply step (the server keeps it a while). */
  token: string;
  file: { name: string; size: number; rows: number };
  counts: Record<ImportChange, number>;
  rows: ImportRow[];
}

/** A CSV the server accepts (some systems send no type, or Excel's, for .csv). */
export const isCsv = (file: File) =>
  file.name.toLowerCase().endsWith('.csv') &&
  ['text/csv', 'application/vnd.ms-excel', 'text/plain', ''].includes(file.type);
export const MAX_CSV_BYTES = 2 * 1024 * 1024;

export const importSampleHref = `${API_BASE}${SUPERVISOR_API}/cases/import/sample/`;

/** Reads the file and answers what it would change; nothing is stored yet. */
export function usePreviewImport() {
  return useMutation({
    mutationFn: (file: File) => {
      const body = new FormData();
      body.append('file', file);
      return api<ImportPreview>(`${SUPERVISOR_API}/cases/import/preview/`, {
        method: 'POST',
        body,
      });
    },
  });
}

export function useApplyImport() {
  return useSupervisorMutation(({ token, notify }: { token: string; notify: boolean }) =>
    api<{ applied: number }>(`${SUPERVISOR_API}/cases/import/`, {
      method: 'POST',
      body: { token, notify },
    }),
  );
}
