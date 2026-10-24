import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router';
import { tabClass } from '@/components/ui/buttonStyles';
import { useFormat } from '@/lib/i18n/useFormat';
import type { CustomerData } from '../api';
import { customerPath } from '../paths';

const TABS = ['summary', 'purchases', 'payments', 'info', 'apply'] as const;

/** Sections of the customer page, as links (each is its own URL). */
export function CustomerTabs({ customer }: { customer: CustomerData }) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const count = { purchases: customer.counts.purchases, payments: customer.counts.payments };
  return (
    <nav
      aria-label={t('customer.tabs.label')}
      className="-mx-4 flex [scrollbar-width:none] gap-1.5 overflow-x-auto px-4 py-0.5 lg:mx-0 lg:px-0.5"
    >
      {TABS.map((tab) => (
        <NavLink
          key={tab}
          to={tab === 'summary' ? customerPath(customer.id) : `${customerPath(customer.id)}/${tab}`}
          end
          className={({ isActive }) => tabClass(isActive)}
        >
          {t(`customer.tabs.${tab}`)}
          {(tab === 'purchases' || tab === 'payments') && count[tab] > 0 && (
            <span className="text-[13px] font-normal text-text-2">{f.number(count[tab])}</span>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
