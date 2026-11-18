import { useTranslation } from 'react-i18next';
import { Outlet } from 'react-router';
import { SectionNav } from '@/components/ui/SectionNav';
import { getRoles } from '@/lib/auth/roles';
import { useUser } from '@/lib/auth/session';

/**
 * «من» (/me): a staff member's own pages. Everyone has their KPIs and pay; sellers also have their
 * sales month (the sales panel's «عملکرد», opened with their password), as a second tab.
 */
export function MeLayout() {
  const { t } = useTranslation();
  const seller = getRoles(useUser()).includes('sales');
  return (
    <div className="flex flex-col gap-4">
      {seller && (
        <SectionNav
          label={t('me.nav')}
          sections={[
            { id: 'pay', to: '/me', label: t('me.pay') },
            { id: 'sales', to: '/me/sales', label: t('me.sales') },
          ]}
        />
      )}
      <Outlet />
    </div>
  );
}
