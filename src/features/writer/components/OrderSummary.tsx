import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { buttonClass } from '@/components/ui/buttonStyles';
import { Chip, type ChipTone } from '@/components/ui/Chip';
import { Icon } from '@/components/ui/Icon';
import { useFormat } from '@/lib/i18n/useFormat';
import { safeHref } from '@/lib/url';
import type { OrderData, OrderState } from '../api';
import { orderPath } from '../paths';
import { useOrderText } from './useOrderText';

const TONE: Record<OrderState, ChipTone> = {
  new: 'primary',
  drafting: 'info',
  revision: 'warn',
  waiting_applicant: 'neutral',
  delivered: 'good',
};

/** The order at a glance: who and what, where it is, when the next version is due. */
export function OrderSummary({ order }: { order: OrderData }) {
  const { t } = useTranslation('writer');
  const f = useFormat();
  const { typeName, due } = useOrderText();
  const meta = [
    t('fileNumber', { n: f.digits(String(order.file_number)) }),
    order.program,
    order.words &&
      t('order.words', { min: f.number(order.words.min), max: f.number(order.words.max) }),
  ].filter(Boolean);

  return (
    <section
      aria-label={t('order.summary')}
      className="flex flex-col gap-5 rounded-card bg-hero p-5 text-on-hero shadow-hero lg:p-8"
    >
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="flex min-w-0 flex-col gap-2.5">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="m-0 font-display text-2xl leading-snug font-bold lg:text-[30px]">
              {t('order.title', { type: typeName(order.type), name: order.applicant.name })}
            </h1>
            <Chip tone={TONE[order.state]}>
              {order.state === 'revision' && order.round
                ? t('order.round', {
                    current: f.number(order.round.current),
                    max: f.number(order.round.max),
                  })
                : t(`state.${order.state}`)}
            </Chip>
          </div>
          <bdi className="text-[15px] text-on-hero-2">{meta.join(' · ')}</bdi>
          <span className="text-sm text-on-hero-2">
            {[
              order.supervisor && t('order.supervisor', { name: order.supervisor }),
              t('order.ordered', { date: f.dateShort(order.ordered_at) }),
            ]
              .filter(Boolean)
              .join(' · ')}
          </span>
        </div>
        {order.due_at && order.state !== 'delivered' && (
          <div className="flex flex-col gap-1 rounded-2xl bg-hero-raised px-5 py-3.5">
            <span className="text-[13px] text-on-hero-2">
              {t(order.state === 'revision' ? 'order.dueRevision' : 'order.dueNext')}
            </span>
            <span className="text-base font-bold text-hero-current">
              {t('order.dueAt', { date: f.weekday(order.due_at), left: due(order.due_at) })}
            </span>
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Link to={orderPath(order.id, 'tickets')} className={buttonClass('primary')}>
          <Icon name="chat" size={18} />
          {t('order.chat')}
          {order.unread > 0 && (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-on-primary px-1.5 text-xs font-semibold text-primary">
              {f.number(order.unread)}
            </span>
          )}
        </Link>
        {order.form_pdf && (
          <a
            href={safeHref(order.form_pdf)}
            download
            className="inline-flex h-11 items-center gap-2 rounded-full bg-hero-raised px-5 text-[15px] font-medium text-on-hero shadow-[inset_0_0_0_1px_var(--hero-line)]"
          >
            <Icon name="download" size={18} />
            {t('order.formPdf')}
          </a>
        )}
      </div>
    </section>
  );
}
