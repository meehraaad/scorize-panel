import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { buttonClass } from '@/components/ui/buttonStyles';
import { StatusText, type ChipTone } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import { SectionCard } from '@/components/ui/SectionCard';
import { useFormat } from '@/lib/i18n/useFormat';
import type { ContractData, Installment, InstallmentStatus } from '../api';

const TONE: Record<InstallmentStatus, ChipTone> = {
  paid: 'good',
  due: 'warn',
  review: 'info',
  upcoming: 'neutral',
};

/**
 * Prepayment and instalments as one divided list: what is paid, what is due now and what comes
 * later, each status as colored text. Design: canvas "Scorize New User Dashboard v2", ContractActive.
 */
export function InstallmentsCard({ contract }: { contract: ContractData }) {
  const { t } = useTranslation('contract');
  const f = useFormat();
  const { installments } = contract;
  const total = installments.reduce((sum, item) => sum + item.amount, 0);
  const paid = installments
    .filter((item) => item.status === 'paid')
    .reduce((sum, item) => sum + item.amount, 0);
  const free = contract.kind === 'turkey';
  // Instalments are priced in the contract's currency.
  const money = (amount: number) =>
    f.price(amount, contract.currency, (value) => t('amount', { amount: value }));

  return (
    <SectionCard
      id="contract-installments"
      title={t('installments.title')}
      subtitle={t('installments.subtitle')}
      end={
        installments.length > 0 && (
          <dl className="m-0 flex gap-5 text-sm">
            <div className="flex flex-col gap-0.5">
              <dt className="text-text-2">{t('installments.paid')}</dt>
              <dd className="m-0 font-bold text-good">{money(paid)}</dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-text-2">{t('installments.left')}</dt>
              <dd className="m-0 font-bold">{money(total - paid)}</dd>
            </div>
          </dl>
        )
      }
    >
      {free ? (
        <div className="px-5 pb-5 lg:px-8 lg:pb-8">
          <p className="m-0 flex items-center gap-3 rounded-[18px] bg-good-tint px-5 py-[18px] text-[15px] leading-7">
            <Icon name="check" className="flex-none text-good" />
            {t('installments.free')}
          </p>
        </div>
      ) : installments.length === 0 ? (
        <EmptyState title={t('installments.emptyTitle')} icon="card">
          {t('installments.empty')}
        </EmptyState>
      ) : (
        <ol className="m-0 list-none p-0 pt-2">
          {installments.map((item) => (
            <InstallmentRow key={item.id} item={item} />
          ))}
        </ol>
      )}
    </SectionCard>
  );
}

function InstallmentRow({ item }: { item: Installment }) {
  const { t } = useTranslation('contract');
  const f = useFormat();
  const name =
    item.number === 0
      ? t('installments.prepayment')
      : t('installments.number', { n: f.number(item.number) });
  const when = [
    item.condition && t('installments.condition', { text: item.condition }),
    item.due_date && t('installments.dueDate', { date: f.date(item.due_date) }),
    item.note,
    item.paid_at && t('installments.paidOn', { date: f.date(item.paid_at) }),
  ]
    .filter(Boolean)
    .join(' · ');
  const payment = item.payment_id === null ? null : `/payments/${String(item.payment_id)}`;

  return (
    <li className="flex flex-wrap items-center gap-x-5 gap-y-3 px-5 py-4 shadow-[inset_0_1px_0_var(--hair)] lg:px-8 lg:py-[18px]">
      <span className="flex min-w-0 flex-[1_1_200px] flex-col gap-1">
        <span className="text-base font-semibold">{name}</span>
        {when && <span className="text-[13px] leading-6 text-text-2">{when}</span>}
      </span>
      <span className="flex flex-col items-end gap-1.5">
        <span className="text-base font-bold tabular-nums">
          {f.price(item.amount, item.currency, (amount) => t('amount', { amount }))}
        </span>
        <StatusText tone={TONE[item.status]}>{t(`installments.status.${item.status}`)}</StatusText>
      </span>
      {payment && item.status === 'due' && (
        <div className="flex gap-2 max-sm:w-full">
          <Link to={`${payment}?method=receipt`} className={buttonClass('outline', 'flex-auto')}>
            {t('installments.uploadReceipt')}
          </Link>
          <Link to={payment} className={buttonClass('primary', 'flex-auto')}>
            {t('installments.payOnline')}
          </Link>
        </div>
      )}
      {payment && item.status === 'review' && (
        <Link to={payment} className={buttonClass('outline', 'max-sm:w-full')}>
          {t('installments.details')}
        </Link>
      )}
    </li>
  );
}
