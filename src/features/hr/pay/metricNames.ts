import { useTranslation } from 'react-i18next';
import type { Metric } from './api';

/**
 * The metrics and calculators the panel has words for (`pay.metric.*`, `pay.calculator.*`). One
 * Django adds later shows with the label Django sends until it gets words here.
 */
const METRICS = {
  manual: 'manual',
  'attendance.late_days': 'attendanceLateDays',
  'attendance.late_minutes': 'attendanceLateMinutes',
  'attendance.absent_days': 'attendanceAbsentDays',
  'attendance.worked_hours': 'attendanceWorkedHours',
  'tasks.on_time_percent': 'tasksOnTime',
  'tasks.late': 'tasksLate',
  'sales.contracts_won': 'salesContracts',
  'sales.paid_sales': 'salesPaid',
  'survey.supervisor_satisfied': 'surveySupervisor',
  'tasks.penalized_on_time_percent': 'tasksPenalizedOnTime',
  'tasks.penalized_late': 'tasksPenalizedLate',
  'tickets.answer_hours': 'ticketsAnswerHours',
  'tickets.slow_answers': 'ticketsSlow',
  'applications.on_time_percent': 'applicationsOnTime',
  'applications.submitted': 'applicationsSubmitted',
  'applications.accepted': 'applicationsAccepted',
  'writing.delivered': 'writingDelivered',
} as const;

const GROUPS = [
  'manual',
  'attendance',
  'tasks',
  'sales',
  'survey',
  'tickets',
  'applications',
  'writing',
] as const;

const CALCULATORS = { 'sales.commission': 'salesCommission' } as const;

const known = <T extends object>(map: T, key: string): key is Extract<keyof T, string> =>
  Object.hasOwn(map, key);

export function useMetricNames() {
  const { t } = useTranslation('hr');
  return {
    metric: (key: string, fallback = key) =>
      known(METRICS, key) ? t(`pay.metric.${METRICS[key]}`) : fallback,
    group: (group: string) =>
      (GROUPS as readonly string[]).includes(group)
        ? t(`pay.metricGroup.${group as (typeof GROUPS)[number]}`)
        : group,
    calculator: (key: string, fallback = key) =>
      known(CALCULATORS, key) ? t(`pay.calculator.${CALCULATORS[key]}`) : fallback,
  };
}

/** The unit to suggest for a metric: the panel's words for the ones it knows. */
export function useMetricUnit() {
  const { t } = useTranslation('hr');
  return (metric: Metric | undefined) => {
    if (!metric || !metric.unit) return '';
    const key = known(METRICS, metric.key) ? METRICS[metric.key] : null;
    return key && key !== 'manual' ? t(`pay.metricUnit.${key}`) : metric.unit;
  };
}
