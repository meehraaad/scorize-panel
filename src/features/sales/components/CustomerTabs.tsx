import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router';
import { useFormat } from '@/lib/i18n/useFormat';
import type { CustomerData } from '../api';
import { customerPath } from '../paths';

/** Purchases, payments, the contract and its instalments are one tab: "contract and money". */
const TABS = ['summary', 'money', 'info', 'apply'] as const;

/** Sections of the customer page, as links (each is its own URL). */
export function CustomerTabs({ customer }: { customer: CustomerData }) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const money = customer.counts.purchases + customer.counts.payments;
  return (
    <nav
      aria-label={t('customer.tabs.label')}
      className="relative -mx-4 flex [scrollbar-width:none] gap-1 overflow-x-auto px-4 shadow-[inset_0_-1px_0_var(--hair)] lg:mx-0 lg:px-0"
    >
      {TABS.map((tab) => (
        <NavLink
          key={tab}
          to={tab === 'summary' ? customerPath(customer.id) : `${customerPath(customer.id)}/${tab}`}
          end
          className={({ isActive }) =>
            `inline-flex h-12 flex-none items-center gap-1.5 border-b-[2.5px] px-4 text-[15px] whitespace-nowrap ${
              isActive
                ? 'border-primary font-bold text-text'
                : 'border-transparent font-medium text-text-2 hover:text-text'
            }`
          }
        >
          {t(`customer.tabs.${tab}`)}
          {tab === 'money' && money > 0 && (
            <span className="rounded-full bg-neutral-tint px-2 text-xs font-semibold text-text-2">
              {f.number(money)}
            </span>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
