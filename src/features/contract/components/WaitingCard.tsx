import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { buttonClass } from '@/components/ui/buttonStyles';
import { Card } from '@/components/ui/Card';
import { StatusText } from '@/components/ui/Chip';
import { SideSection } from '@/components/ui/SectionCard';
import { useFormat } from '@/lib/i18n/useFormat';
import type { ContractData } from '../api';
import { missingDetails } from './profileRules';

/**
 * "Waiting for you": only what needs the applicant now, each from a real row: an instalment that is
 * due (why now, and how to pay it) and the details the team still needs. Nothing waiting: not shown.
 * Design: canvas "Scorize New User Dashboard v2", ContractActive.
 */
export function WaitingCard({ contract }: { contract: ContractData }) {
  const { t } = useTranslation('contract');
  const f = useFormat();
  const due = contract.installments.filter(
    (item) => item.status === 'due' && item.payment_id !== null,
  );
  const missing = missingDetails(contract);
  if (due.length === 0 && missing.length === 0) return null;
  const count = contract.installments.filter((item) => item.number > 0).length;

  return (
    <SideSection id="contract-waiting" title={t('waiting.title')} subtitle={t('waiting.subtitle')}>
      <Card className="px-5 lg:px-7">
        <ul className="m-0 list-none p-0">
          {due.map((item) => {
            const payment = `/payments/${String(item.payment_id)}`;
            const why = [item.condition, item.note].filter(Boolean).join(' · ');
            return (
              <li
                key={item.id}
                className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4 py-5 shadow-[inset_0_-1px_0_var(--hair)] last:shadow-none lg:py-6"
              >
                <div className="flex min-w-0 flex-[1_1_280px] flex-col gap-1.5">
                  <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]">
                    <StatusText tone="warn">{t('installments.status.due')}</StatusText>
                    <span className="text-text-2">
                      {item.number === 0
                        ? t('installments.prepayment')
                        : t('waiting.of', { n: f.number(item.number), total: f.number(count) })}
                    </span>
                  </span>
                  <span className="font-display text-[28px] leading-tight font-bold tabular-nums lg:text-[32px]">
                    {f.price(item.amount, item.currency, (amount) => t('amount', { amount }))}
                  </span>
                  {why && (
                    <span className="text-sm leading-7 text-text-2">
                      {t('waiting.why', { text: why })}
                    </span>
                  )}
                </div>
                <div className="flex flex-col items-stretch gap-1 max-sm:w-full">
                  <Link to={payment} className={buttonClass('primary', 'px-8')}>
                    {t('waiting.payOnline')}
                  </Link>
                  <Link
                    to={`${payment}?method=receipt`}
                    className="inline-flex min-h-11 items-center justify-center text-sm font-semibold text-primary-text"
                  >
                    {t('waiting.receipt')}
                  </Link>
                </div>
              </li>
            );
          })}
          {missing.length > 0 && (
            <li className="flex flex-wrap items-center justify-between gap-x-8 gap-y-2 py-5">
              <div className="flex min-w-0 flex-[1_1_280px] flex-col gap-1">
                <StatusText tone="warn">
                  {t('waiting.missing', { n: f.number(missing.length) })}
                </StatusText>
                <span className="text-[17px] font-bold">
                  {f.list(missing.map((field) => t(`profile.field.${field}`)))}
                </span>
                <span className="text-sm leading-7 text-text-2">{t('waiting.missingText')}</span>
              </div>
              <a
                href="#contract-profile"
                className="inline-flex min-h-11 items-center text-[15px] font-bold text-primary-text"
              >
                {t('waiting.fill')}
              </a>
            </li>
          )}
        </ul>
      </Card>
    </SideSection>
  );
}
