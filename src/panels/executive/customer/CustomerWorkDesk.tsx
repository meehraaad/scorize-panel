import { useTranslation } from 'react-i18next';
import { NavLink, Outlet, useOutletContext, useParams } from 'react-router';
import { buttonClass } from '@/components/ui/buttonStyles';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageStack } from '@/components/ui/PageColumns';
import { useUser } from '@/lib/auth/session';
import { serviceTitle } from '@/features/supervisor/api/services';
import { CustomerWritingDesk } from './CustomerWritingDesk';
import { type CustomerWorkspace } from './api';
import { customerWorkspacePath } from './paths';

export default function CustomerWorkDesk() {
  const { t } = useTranslation(['executive', 'writer']);
  const { service: active } = useParams();
  const workspace = useOutletContext<CustomerWorkspace>();
  const staff = useUser().staff?.id;
  const { services, writing, id } = workspace;
  const tabs = services.filter((service) => workspace.service_tabs.includes(service.id));
  const canReadWriting = writing.length > 0;
  return (
    <PageStack>
      {(tabs.length > 0 || canReadWriting) && (
        <nav className="customer-service-tabs" aria-label={t('workspace.serviceTabs')}>
          {tabs.map((service) => (
            <NavLink
              key={service.id}
              end
              to={customerWorkspacePath(id, `desk/${String(service.id)}`)}
              className={({ isActive }) => buttonClass(isActive ? 'dark' : 'outline')}
            >
              {serviceTitle(service)}
              <span className="text-label font-normal">
                {service.owner?.id === staff
                  ? t('customers.you')
                  : (service.owner?.name ?? t('customers.unassigned'))}
              </span>
            </NavLink>
          ))}
          {canReadWriting && (
            <NavLink
              end
              to={customerWorkspacePath(id, 'desk/writing')}
              className={({ isActive }) => buttonClass(isActive ? 'dark' : 'outline')}
            >
              {t('writing')}
            </NavLink>
          )}
        </nav>
      )}
      {active &&
        active !== 'writing' &&
        (tabs.some((service) => String(service.id) === active) ? (
          <Outlet context={workspace} />
        ) : (
          <EmptyState variant="card">{t('workspace.serviceUnavailable')}</EmptyState>
        ))}
      {canReadWriting && active === 'writing' && <CustomerWritingDesk orders={writing} />}
      {!canReadWriting && active === 'writing' && (
        <EmptyState variant="card">{t('workspace.serviceUnavailable')}</EmptyState>
      )}
      {!active && !tabs.length && !writing.length && workspace.case && (
        <Outlet context={workspace} />
      )}
      {!workspace.case && !tabs.length && !writing.length && (
        <EmptyState variant="card">{t('workspace.serviceUnavailable')}</EmptyState>
      )}
    </PageStack>
  );
}
