import { useTranslation } from 'react-i18next';
import { useFormat } from '@/lib/i18n/useFormat';
import { scoreBand, type LeadStage } from '@/lib/sales/api';

const MINUTE = 60_000;
const DAY = 86_400_000;

const startOfDay = (value: Date) => {
  const day = new Date(value);
  day.setHours(0, 0, 0, 0);
  return day.getTime();
};

/** Whole calendar days from `value` to today (0 = today). */
export const daysOverdue = (value: string, now = Date.now()) =>
  Math.round((startOfDay(new Date(now)) - startOfDay(new Date(value))) / DAY);

/** Wording shared by the sales pages: scores, follow-up dates, amounts, ages. */
export function useSalesFormat() {
  const { t } = useTranslation('sales');
  const f = useFormat();

  const duration = (minutes: number) => {
    if (minutes < 60) return t('board.age.minutes', { n: f.number(minutes) });
    if (minutes < 24 * 60) return t('board.age.hours', { n: f.number(Math.round(minutes / 60)) });
    return t('board.age.days', { n: f.number(Math.round(minutes / (24 * 60))) });
  };

  return {
    /** "Hot · 86". */
    score: (score: number) =>
      t('score', { band: t(`band.${scoreBand(score)}`), score: f.number(score) }),
    /** "110 million toman" (amounts on cards and summaries). */
    millions: (toman: number) =>
      t('millionToman', { n: f.number(Math.round((toman / 1_000_000) * 10) / 10) }),
    toman: (toman: number) => t('toman', { amount: f.number(toman) }),
    percent: (share: number) => t('percent', { n: f.number(Math.round(share * 100)) }),
    minutes: (n: number) => t('minutes', { n: f.number(n) }),
    /**
     * When to follow up, and whether it is late: "Now" for a lead nobody called, "2 days overdue",
     * "Today 11:00", or a date. `dateOnly`: the server keeps no time (StaffToDo), so no clock.
     */
    due: (
      followUp: string | null,
      stage: LeadStage,
      contacted: boolean,
      dateOnly = false,
    ): { text: string; urgent: boolean } => {
      if (stage === 'new' && !contacted) return { text: t('due.now'), urgent: true };
      if (!followUp || stage === 'won' || stage === 'lost')
        return { text: t('due.none'), urgent: false };
      const late = daysOverdue(followUp);
      if (late > 0) return { text: t('due.overdue', { n: f.number(late) }), urgent: true };
      if (late === 0) {
        const past = new Date(followUp).getTime() < Date.now();
        return {
          text: dateOnly ? t('due.todayDay') : t('due.today', { time: f.time(followUp) }),
          urgent: past,
        };
      }
      return {
        text: dateOnly
          ? f.dateShort(followUp)
          : t('due.later', { date: f.dateShort(followUp), time: f.time(followUp) }),
        urgent: false,
      };
    },
    /** How long ago, without the clock time: "4 minutes", "5 hours", "9 days". */
    age: (since: string) =>
      duration(Math.max(0, Math.round((Date.now() - new Date(since).getTime()) / MINUTE))),
    /** A number of minutes, in the largest whole unit. */
    duration,
  };
}
