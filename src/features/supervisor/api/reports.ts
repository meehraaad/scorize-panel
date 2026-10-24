import { queryOptions } from '@tanstack/react-query';
import { API_BASE, api } from '@/lib/api/client';
import { SUPERVISOR_API, SUPERVISOR_KEY, type CaseStage } from './common';

/** Report periods: this calendar month, the previous one, the last three months. */
export const REPORT_PERIODS = ['month', 'last_month', 'quarter'] as const;
export type ReportPeriod = (typeof REPORT_PERIODS)[number];

/**
 * The supervisor's own work on their cases over a period (SV15): what went well and what fell
 * behind. Every number is the server's; the page only lays them out.
 */
export interface ReportsData {
  /** The period's first and last day (the page names the month). */
  start: string;
  end: string;
  /** Applications submitted in the period, and the change from the period before. */
  submitted: { count: number; change: number };
  /** Admissions in the period, out of the results that came in. */
  accepted: { count: number; results: number };
  /** Tasks done on time, in percent, and the team's goal. */
  on_time: { percent: number; goal: number };
  /** Uploads waiting for review now, and since when the oldest waits. */
  documents_waiting: { count: number; oldest_at: string | null };
  /**
   * The last six months, oldest first: submitted applications and admissions. `month` is a day in
   * that month; the server counts months in the user's calendar (Jalali in Persian).
   */
  months: { month: string; submitted: number; accepted: number }[];
  /** This academic year by country, for the supervisor's cases. */
  countries: {
    country: string;
    submitted: number;
    accepted: number;
    rejected: number;
    waiting: number;
  }[];
  /** Deadlines of the period that passed without the application going out. */
  missed: {
    application: number;
    applicant: { id: number; name: string };
    university: string;
    deadline: string;
    /** Written by the supervisor when the deadline is marked missed (SV16). */
    reason: string | null;
  }[];
  /** First replies to applicants' tickets in the period. */
  replies: {
    median_minutes: number | null;
    /** Answered the same working day, in percent, and the goal. */
    same_day: number;
    goal: number;
    slowest: { applicant: string; minutes: number } | null;
    /** The longest first reply to a «خیلی ضروری» message. */
    urgent_max_minutes: number | null;
  };
  /** Open cases with nothing done for more than 14 days, longest first. */
  idle: { id: number; name: string; stage: CaseStage; days: number }[];
  /** The professor-email bot over the period. */
  bot: { sent: number; replied: number; active: number; applying: number; stopped: number };
}

export const reportsQuery = (period: ReportPeriod) =>
  queryOptions({
    queryKey: [...SUPERVISOR_KEY, 'reports', period],
    queryFn: ({ signal }) =>
      api<ReportsData>(`${SUPERVISOR_API}/reports/?period=${period}`, { signal }),
  });

/** The same report as a spreadsheet (one sheet per table). A plain download link. */
export const reportsExportHref = (period: ReportPeriod) =>
  `${API_BASE}${SUPERVISOR_API}/reports/export/?period=${period}`;
