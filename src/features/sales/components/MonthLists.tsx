import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Chip, type ChipTone } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { useFormat } from '@/lib/i18n/useFormat';
import type { Instalment, InstalmentState, MonthContract } from '../api/month';
import { useSalesFormat } from '../format';
import { customerPath } from '../paths';

const row =
  'flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-4 shadow-[inset_0_1px_0_var(--hair)] lg:flex-nowrap lg:px-8';

const STATE_TONE: Record<InstalmentState, ChipTone> = {
  paid: 'good',
  overdue: 'danger',
  due: 'warn',
  waiting: 'neutral',
};

/** "۱۲۰ میلیون تومان", or the other currency's text. */
function useAmount() {
  const s = useSalesFormat();
  return (item: { amount: number | null; amount_text: string | null }) =>
    item.amount === null ? (item.amount_text ?? '') : s.millions(item.amount);
}

/**
 * A month's closed contracts: whose customer, what it covers, when it was closed and for how much.
 * `showSeller` names the seller each counts for (the manager's view); `action` adds a button.
 */
export function ContractList({
  rows,
  showSeller = false,
  action,
  empty,
}: {
  rows: MonthContract[];
  showSeller?: boolean;
  action?: (row: MonthContract) => ReactNode;
  /** The text when there are none (default: the seller's own month). */
  empty?: string;
}) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const amount = useAmount();
  if (rows.length === 0) return <EmptyState>{empty ?? t('month.contracts.empty')}</EmptyState>;
  return (
    <ul className="m-0 list-none p-0">
      {rows.map((item) => (
        <li key={item.lead} className={row}>
          <span className="flex min-w-0 flex-[1_1_240px] flex-col gap-1">
            <Link
              to={customerPath(item.customer)}
              className="text-base font-semibold text-text hover:underline"
            >
              {item.name}
            </Link>
            <span className="text-sm text-text-2">
              {[
                item.title,
                t('month.contracts.closed', { date: f.date(item.won_at) }),
                showSeller && item.seller ? t('month.contracts.for', { seller: item.seller }) : '',
              ]
                .filter(Boolean)
                .join(' · ')}
            </span>
          </span>
          <span className="text-base font-bold tabular-nums">{amount(item)}</span>
          {item.status && (
            <Chip tone="info" small>
              {item.status}
            </Chip>
          )}
          {action?.(item)}
        </li>
      ))}
    </ul>
  );
}

/** Instalments to collect: who pays, which instalment, when it is due and whether it is paid. */
export function InstalmentList({ rows }: { rows: Instalment[] }) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const amount = useAmount();
  if (rows.length === 0) return <EmptyState>{t('month.instalments.empty')}</EmptyState>;
  return (
    <ul className="m-0 list-none p-0">
      {rows.map((item) => (
        <li
          key={item.id}
          className={`${row} ${item.state === 'overdue' ? 'bg-row-highlight' : ''}`}
        >
          <span className="flex min-w-0 flex-[1_1_240px] flex-col gap-1">
            <Link
              to={`${customerPath(item.customer)}/payments`}
              className="text-base font-semibold text-text hover:underline"
            >
              {item.name}
            </Link>
            <span className="text-sm text-text-2">
              {[
                item.title,
                item.due
                  ? t('month.instalments.due', { date: f.date(item.due) })
                  : (item.condition ?? ''),
              ]
                .filter(Boolean)
                .join(' · ')}
            </span>
          </span>
          <span className="text-base font-bold tabular-nums">{amount(item)}</span>
          <Chip tone={STATE_TONE[item.state]} small>
            {t(`instalment.state.${item.state}`)}
          </Chip>
        </li>
      ))}
    </ul>
  );
}
