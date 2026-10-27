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
        className="mx-auto grid w-full max-w-md grid-cols-2 gap-1 rounded-full bg-board p-1 shadow-[inset_0_0_0_1px_var(--hair)]"
      >
        {SECTIONS.map((section) => (
          <NavLink
            key={section.id}
            to={salesPath(section.to)}
            end
            className={({ isActive }) =>
              `${tabClass(isActive)} h-12 min-w-0 justify-center px-3 ${isActive ? 'font-semibold' : ''}`
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  name={section.icon}
                  size={18}
                  className={`flex-none ${isActive ? 'text-primary' : ''}`}
                />
                <span className="truncate">{t(`leadsSection.${section.id}`)}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </PageStack>
  );
}
