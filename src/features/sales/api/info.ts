import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { SALES_API } from '@/lib/sales/api';
import { customerKey } from './customer';

export interface Option {
  value: string;
  label: string;
}

export interface EducationEntry {
  /** Missing for a new row. */
  id?: number;
  degree: string;
  field: string;
  university: string;
  gpa: string;
}

export interface ExamEntry {
  id?: number;
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
  goal: { wanted_degree: string; budget: string; countries: string; language: string };
  education: EducationEntry[];
  exams: ExamEntry[];
  /** Choices of the select fields (Django model choices), localized. */
  choices: Record<'gender' | 'marital' | 'military' | 'budget' | 'degree' | 'exam', Option[]>;
  /** The office tablet form for this customer (crm user_detail tablet form). */
  tablet_url: string;
  updated_at: string;
}

export const infoQuery = (id: number) =>
  queryOptions({
    queryKey: [...customerKey(id), 'info'],
    queryFn: ({ signal }) =>
      api<CustomerInfo>(`${SALES_API}/customers/${String(id)}/info/`, { signal }),
  });

export type InfoSection = Partial<Pick<CustomerInfo, 'personal' | 'goal' | 'education' | 'exams'>>;

/** Saves one section; the server answers the stored info (S27). */
export function useSaveInfo(id: number) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (section: InfoSection) =>
      api<CustomerInfo>(`${SALES_API}/customers/${String(id)}/info/`, {
        method: 'PATCH',
        body: section,
      }),
    onSuccess: (data) => {
      client.setQueryData(infoQuery(id).queryKey, data);
      return client.invalidateQueries({ queryKey: customerKey(id), exact: true });
    },
  });
}
