import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Avatar } from '@/components/ui/Avatar';
import { buttonClass } from '@/components/ui/buttonStyles';
import { Chip } from '@/components/ui/Chip';
import { Badge } from '@/components/ui/SectionCard';
import { daysUntil, isPast } from '@/lib/dates';
import { useFormat } from '@/lib/i18n/useFormat';
import type { OrderRow } from '../api';
import { orderPath } from '../paths';
import { useOrderText } from './useOrderText';

/** Due in this many days or fewer: the date shows in the urgent colour. */
const SOON_DAYS = 3;

/** The queue: one row per order, the applicant's revision requests highlighted. */
export function OrderList({ orders }: { orders: OrderRow[] }) {
  return (
    <ul className="m-0 list-none p-0">
      {orders.map((order) => (
        <Row key={order.id} order={order} />
      ))}
    </ul>
  );
}

function Row({ order }: { order: OrderRow }) {
  const { t } = useTranslation('writer');
  const f = useFormat();
  const { typeName, status, due } = useOrderText();
  const type = typeName(order.type);
  const soon =
    order.state !== 'delivered' &&
    order.due_at !== null &&
    (isPast(order.due_at) || daysUntil(order.due_at) <= SOON_DAYS);
  const dot =
    order.state === 'revision' ? 'bg-urgent' : order.state === 'new' ? 'bg-primary' : 'bg-track';

  return (
    <li
      className={`flex flex-wrap items-center gap-x-5 gap-y-3 px-5 py-5 not-first:shadow-[inset_0_1px_0_var(--hair)] lg:px-7 ${
        order.state === 'revision' ? 'bg-row-highlight' : ''
      }`}
    >
      <span className="flex min-w-0 flex-[1_1_260px] items-center gap-3">
        <Avatar name={order.applicant} />
        <span className="flex min-w-0 flex-col gap-1">
          <span className="flex flex-wrap items-center gap-2">
            <Link to={orderPath(order.id)} className="text-base font-semibold text-text">
              {order.applicant}
            </Link>
            <Chip tone="neutral" small>
              {type}
            </Chip>
          </span>
          <span className="text-[13px] text-text-2">
            {t('fileNumber', { n: f.digits(String(order.file_number)) })}
            {order.program && (
              <>
                {' · '}
                <bdi>{order.program}</bdi>
              </>
            )}
          </span>
        </span>
      </span>
      <span className="flex flex-[1_1_200px] items-start gap-2 text-sm leading-7">
        <span aria-hidden="true" className={`mt-2.5 size-2 flex-none rounded-full ${dot}`} />
        {status(order)}
      </span>
      <span className="flex flex-[0_0_110px] flex-col gap-0.5">
        <span className="text-xs text-text-2">
          {order.state === 'delivered' ? t('queue.delivered') : t('queue.due')}
        </span>
        <span className={`text-sm font-semibold ${soon ? 'text-urgent' : ''}`}>
          {order.state === 'delivered'
            ? order.delivered_at && f.dateShort(order.delivered_at)
            : due(order.due_at)}
        </span>
      </span>
      <span className="flex items-center gap-2.5">
        {order.unread > 0 && (
          <span className="inline-flex items-center gap-1.5 text-[13px] text-text-2">
            <Badge>{f.number(order.unread)}</Badge>
            {t('queue.newMessages')}
          </span>
        )}
        <Link
          to={orderPath(order.id)}
          aria-label={t('queue.openNamed', { type, name: order.applicant })}
          className={buttonClass('outline', 'h-10 px-4 text-sm')}
        >
          {t('queue.open')}
        </Link>
      </span>
    </li>
  );
}
