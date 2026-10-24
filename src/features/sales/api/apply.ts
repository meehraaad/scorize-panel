import { queryOptions } from '@tanstack/react-query';
import { ApiError, api } from '@/lib/api/client';
import { SALES_API, type Degree } from '@/lib/sales/api';
import { customerKey } from './customer';

export interface ApplyFile {
  /** Applicant status, localized ("Applying"). */
  status: string;
  applies: { used: number; total: number };
  admissions: number;
  emails: { sent: number; total: number };
  contract: {
    active: boolean;
    features: ('admission' | 'writing' | 'visa')[];
    start: string;
    end: string;
    degree: Degree;
    countries: string[];
    supervisors: string[];
    consultant: string | null;
    file_url: string | null;
  };
  applications: {
    id: number;
    university: string;
    program: string;
    fee_paid: boolean;
    status: 'ready' | 'submitted' | 'accepted' | 'rejected';
  }[];
}

export const applyQuery = (id: number) =>
  queryOptions({
    queryKey: [...customerKey(id), 'apply'],
    queryFn: async ({ signal }): Promise<ApplyFile | null> => {
      try {
        return await api<ApplyFile>(`${SALES_API}/customers/${String(id)}/apply/`, { signal });
      } catch (error) {
        // No applicant file yet.
        if (error instanceof ApiError && error.status === 404) return null;
        throw error;
      }
    },
  });
