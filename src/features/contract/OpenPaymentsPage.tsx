import { useSuspenseQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import { PageStack } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { useFormat } from '@/lib/i18n/useFormat';
import { openPaymentsQuery, type OpenPayment } from './api';
import { useMoney } from './payment/money';

/**
 * The person's open payments (canvas A3): a seller's invoice, an instalment, a receipt in review.
 * Each is paid on its own page; paid ones live in "contract" and "services".
 */
export default function OpenPaymentsPage() {
  const { t } = useTranslation('contract');
  const f = useFormat();
  const { data } = useSuspenseQuery(openPaymentsQuery);
  const waiting = data.filter((item) => item.status !== 'review').length;

  return (
    <PageStack>
      <PageHeader
        title={t('payment.open.title')}
        subtitle={
          data.length
            ? t('payment.open.subtitle', {
                n: f.number(data.length),
                waiting: f.number(waiting),
                review: f.number(data.length - waiting),
              })
            : undefined
        }
      />
      {data.length ? (
        <SectionCard id="open-payments" size="md" title={t('payment.open.list')}>
          <ul className="m-0 flex list-none flex-col p-0">
            {data.map((item) => (
              <OpenRow key={item.id} item={item} />
            ))}
          </ul>
          <p className="m-0 px-5 pt-1 pb-4 text-[13px] leading-6 text-text-2 lg:px-[26px]">
            {t('payment.open.note')}
          </p>
        </SectionCard>
      ) : (
        <EmptyState variant="card" icon="card">
          {t('payment.open.empty')}
        </EmptyState>
      )}
    </PageStack>
  );
}

function OpenRow({ item }: { item: OpenPayment }) {
  const { t } = useTranslation('contract');
  const f = useFormat();
  const money = useMoney(item.currency);
  const [now] = useState(Date.now);
  const [first, ...rest] = item.labels;
  const minutes = item.expires_at
    ? Math.max(0, Math.ceil((new Date(item.expires_at).getTime() - now) / 60_000))
    : null;
  const kind = item.installment
    ? t('payment.open.installment')
    : item.seller
      ? t('payment.open.seller')
      : t('payment.open.purchase');
  const when =
    item.status === 'review'
      ? t('payment.open.review')
      : item.status === 'declined'
        ? t('payment.open.declined')
        : item.due_date
          ? t('payment.open.due', { date: f.date(item.due_date) })
          : minutes !== null
            ? minutes > 120
              ? t('payment.open.until', { date: f.dateTime(item.expires_at ?? '') })
              : t('payment.buy.minutesLeft', { minutes: f.number(minutes) })
            : null;

  return (
    <li className="shadow-[inset_0_1px_0_var(--hair)] first:shadow-none">
      <Link
        to={`/payments/${String(item.id)}`}
        className="flex min-h-16 items-center gap-3 px-5 py-3.5 lg:px-[26px]"
      >
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-xs text-text-2">{kind}</span>
          <span className="truncate font-semibold">
            {rest.length ? t('payment.open.andMore', { first, n: f.number(rest.length) }) : first}
          </span>
          {when && (
            <span
              className={`text-[13px] ${item.status === 'declined' ? 'text-danger' : 'text-text-2'}`}
            >
              {when}
            </span>
          )}
        </span>
        <span className="flex flex-col items-end gap-1">
          <b className="whitespace-nowrap tabular-nums">{money(item.amount)}</b>
          {item.status === 'review' ? (
            <Chip tone="info" small>
              {t('payment.open.inReview')}
            </Chip>
          ) : (
            <span className="text-[13px] font-semibold text-primary-text">
              {t('payment.open.pay')}
            </span>
          )}
        </span>
        <Icon name="chevronEnd" size={18} className="flex-none text-text-2" />
      </Link>
    </li>
  );
}
