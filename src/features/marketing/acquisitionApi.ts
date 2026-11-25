import { api } from '@/lib/api/client';
import type { ReportDays } from '@/components/ui/ReportPeriod';

export interface AcquisitionCounts {
  visits: number;
  cta: number;
  started: number;
  reserved: number;
  paid: number;
  bookings: number;
  paid_bookings: number;
  revenue_toman: number;
}

interface Acquisition extends AcquisitionCounts {
  source: string;
  medium: string;
  campaign: string;
  landing: string;
  surface: 'site' | 'panel';
}

export interface AcquisitionReport {
  total: AcquisitionCounts;
  cohorts: Acquisition[];
}

export const acquisitionQuery = (days: ReportDays = 7) => ({
  queryKey: ['marketing-acquisition', days],
  meta: { persist: false },
  queryFn: () => api<AcquisitionReport>(`/marketing/v1/acquisition/?days=${days}`),
});
