import { useTranslation } from 'react-i18next';
import { NavLink, Outlet } from 'react-router';
import { tabClass } from '@/components/ui/buttonStyles';
import { Icon } from '@/components/ui/Icon';
import { PageStack } from '@/components/ui/PageColumns';
import { salesPath } from './paths';

const SECTIONS = [
  { id: 'leads', to: 'leads', icon: 'user' },
  { id: 'consultations', to: 'leads/consultations', icon: 'calendar' },
] as const;

/** One nav tab for the seller's people: their leads and the consultations assigned to them. */
export default function LeadsLayout() {
  const { t } = useTranslation('sales');
  return (
    <PageStack>
      <nav
        aria-label={t('leadsSection.nav')}
        className="mx-auto flex w-full max-w-lg gap-1.5 rounded-full bg-board p-1.5 shadow-[inset_0_0_0_1px_var(--hair)]"
      >
        {SECTIONS.map((section) => (
          <NavLink
            key={section.id}
            to={salesPath(section.to)}
            end
            className={({ isActive }) =>
              `${tabClass(isActive)} h-auto! min-h-14 min-w-0 flex-1 gap-2 px-3! py-2 whitespace-normal! sm:px-6! ${isActive ? 'shadow-panel' : ''}`
            }
          >
            <Icon name={section.icon} size={18} className="flex-none" />
            <span className="text-center leading-6">{t(`leadsSection.${section.id}`)}</span>
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </PageStack>
  );
}
