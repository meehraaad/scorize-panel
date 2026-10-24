import { useTranslation } from 'react-i18next';
import { daysSince, daysUntil, isPast } from '@/lib/dates';
import { useFormat } from '@/lib/i18n/useFormat';
import type { WritingDepartment } from '@/lib/tickets/api';
import type { OrderRow } from '../api';

/** Words the queue and the order page share: the order's type, its status line, its due date. */
export function useOrderText() {
  const { t } = useTranslation('writer');
  const f = useFormat();
  return {
    typeName: (type: WritingDepartment) => t(`type.${type}`),
    /** "Revision round 1; the applicant wrote 3 points", "Draft 2 in progress", … */
    status: (order: Pick<OrderRow, 'state' | 'drafts' | 'round' | 'notes'>) => {
      switch (order.state) {
        case 'new':
          return t('status.new');
        case 'drafting':
          return t('status.drafting', { n: f.number(order.drafts + 1) });
        case 'revision':
          return t('status.revision', {
            round: f.number(order.round?.current ?? 1),
            n: f.number(order.notes),
          });
        case 'waiting_applicant':
          return t('status.waiting', { n: f.number(order.drafts) });
        case 'delivered':
          return t('status.delivered');
      }
    },
    /** "2 days left", "today", "3 days late". */
    due: (at: string | null) => {
      if (!at) return t('dash');
      if (isPast(at)) {
        const late = daysSince(at);
        return late === 0 ? t('due.today') : t('due.late', { n: f.number(late) });
      }
      const days = daysUntil(at);
      return days <= 1 ? t('due.tomorrow') : t('due.left', { n: f.number(days) });
    },
  };
}
