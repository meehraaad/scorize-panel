import { useTranslation } from 'react-i18next';
import { Outlet } from 'react-router';
import { SectionNav } from '@/components/ui/SectionNav';
import { ONBOARDING_PATH } from '@/features/hr/paths';
import { ON_SERVER } from '@/lib/applicant/onServer';
import { getRoles } from '@/lib/auth/roles';
import { useUser } from '@/lib/auth/session';

/**
 * «من» (/me): a staff member's own pages. Everyone has their KPIs and pay; sellers also have their
 * sales month (the sales panel's «عملکرد», opened with their password), and a new hire their
 * personal details form while it is open, each as another tab.
 */
export function MeLayout() {
  const { t } = useTranslation();
  const user = useUser();
  const sections = [
    { id: 'pay', to: '/me', label: t('me.pay') },
    ...(getRoles(user).includes('sales')
      ? [{ id: 'sales', to: '/me/sales', label: t('me.sales') }]
      : []),
    ...(ON_SERVER.hrOnboarding && user.staff?.onboarding
      ? [{ id: 'onboarding', to: ONBOARDING_PATH, label: t('me.onboarding') }]
      : []),
  ];
  return (
    <div className="flex flex-col gap-4">
      {sections.length > 1 && <SectionNav label={t('me.nav')} sections={sections} />}
      <Outlet />
    </div>
  );
}
