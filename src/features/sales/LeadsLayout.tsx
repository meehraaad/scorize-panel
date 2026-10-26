import { useTranslation } from 'react-i18next';
import { NavLink, Outlet } from 'react-router';
import { tabClass } from '@/components/ui/buttonStyles';
import { PageStack } from '@/components/ui/PageColumns';
import { salesPath } from './paths';

const SECTIONS = [
  { id: 'leads', to: 'leads' },
  { id: 'consultations', to: 'leads/consultations' },
] as const;

/** One nav tab for the seller's people: their leads and the consultations assigned to them. */
export default function LeadsLayout() {
  const { t } = useTranslation('sales');
  return (
    <PageStack>
      <nav
        aria-label={t('leadsSection.nav')}
        className="-mx-4 flex [scrollbar-width:none] gap-1.5 overflow-x-auto px-4 py-0.5 lg:mx-0 lg:px-0.5"
      >
        {SECTIONS.map((section) => (
          <NavLink
            key={section.id}
            to={salesPath(section.to)}
            end
            className={({ isActive }) => tabClass(isActive)}
          >
            {t(`leadsSection.${section.id}`)}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </PageStack>
  );
}
