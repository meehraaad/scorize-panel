import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiError, api } from '@/lib/api/client';
import { SALES_API } from '@/lib/sales/api';
import { customerKey } from './customer';

/** Django's model choices the selects offer (UserPersonalInformation; labels from the dictionary). */
export const CHOICES = {
  gender: [1, 2],
  marital: [1, 2],
  military: [1, 2, 3, 4],
  budget: [1, 2, 3],
  /** DegreeChoices / UniversityDegreeChoices (labels: common `degree.<n>`). */
  degree: [0, 1, 2, 3],
} as const;

export interface Option {
  value: string;
  label: string;
}

export interface EducationEntry {
  /** Missing for a new row. */
  id?: number;
  degree: string;
  /** The study field's name (StudyField, found by name on save). */
  field: string;
  university: string;
  gpa: string;
}

export interface ExamEntry {
  id?: number;
  /** Exam id. */
  exam: string;
  score: string;
  /** ISO date, or empty. */
  date: string;
}

export interface CustomerInfo {
  personal: {
    first_name: string;
    last_name: string;
    father_name: string;
    /** ISO date, or empty. */
    birth_date: string;
    gender: string;
    marital: string;
    military: string;
    city: string;
    work_years: string;
  };
  goal: {
    wanted_degree: string;
    budget: string;
    /** Country names, comma separated (Country, found by name on save). */
    countries: string;
    language: string;
  };
  education: EducationEntry[];
  exams: ExamEntry[];
  /** Exams from Django; the other selects use the fixed model choices (CHOICES). */
  exams_list: Option[];
  /** The office tablet form for this customer (the old site's tablet wizard). */
  tablet_url: string;
}

const infoApi = (id: number) => `${SALES_API}/customers/${String(id)}/info/`;

export const infoQuery = (id: number) =>
  queryOptions({
    queryKey: [...customerKey(id), 'info'],
    queryFn: ({ signal }) => api<CustomerInfo>(infoApi(id), { signal }),
  });

/** A country or study field typed on the page that Django doesn't know. */
export class UnknownNameError extends Error {
  constructor(readonly value: string) {
    super(`Not found: ${value}`);
    this.name = 'UnknownNameError';
  }
}

export type InfoSection = Partial<Pick<CustomerInfo, 'personal' | 'goal' | 'education' | 'exams'>>;

type FieldErrors = Record<string, unknown> | undefined;
const hasError = (errors: FieldErrors, key: string) => Boolean(errors && key in errors);

/** "Unknown countries: Atlantis، Narnia" → the names after the colon (Django lists only those). */
function namesIn(messages: unknown, fallback: string) {
  const text = Array.isArray(messages) && typeof messages[0] === 'string' ? messages[0] : '';
  const names = text.slice(text.lastIndexOf(':') + 1).trim();
  return text.includes(':') && names ? names : fallback;
}

/**
 * The name Django didn't find, from a 400 on the section that was sent: `goal.countries`, or
 * `education[n].field` (DRF sends a list of rows, or an object keyed by row index).
 */
function unknownName(section: InfoSection, body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const errors = body as Record<string, unknown>;
  const goal = errors.goal as FieldErrors;
  if (section.goal && hasError(goal, 'countries'))
    return namesIn(goal?.countries, section.goal.countries);
  const rows = errors.education as FieldErrors | FieldErrors[] | undefined;
  if (section.education && rows) {
    const index = Object.entries(rows).find(([, row]) => hasError(row as FieldErrors, 'field'));
    if (index) return section.education[Number(index[0])]?.field ?? null;
  }
  return null;
}

async function saveSection(id: number, section: InfoSection) {
  try {
    return await api<CustomerInfo>(infoApi(id), { method: 'PATCH', body: section });
  } catch (error) {
    const name =
      error instanceof ApiError && error.status === 400 && unknownName(section, error.body);
    if (name) throw new UnknownNameError(name);
    throw error;
  }
}

/** Saves one section and answers the stored info. */
export function useSaveInfo(id: number) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (section: InfoSection) => saveSection(id, section),
    onSuccess: (data) => {
      client.setQueryData(infoQuery(id).queryKey, data);
      return client.invalidateQueries({ queryKey: customerKey(id), exact: true });
    },
  });
}
