import { useTranslation } from 'react-i18next';
import { Link, useOutletContext } from 'react-router';
import { Notebook } from '@/components/notes/Notebook';
import { buttonClass } from '@/components/ui/buttonStyles';
import { PageColumns } from '@/components/ui/PageColumns';
import { SectionCard } from '@/components/ui/SectionCard';
import { CaseContract, CaseTasksCard } from '@/features/supervisor/CaseOverviewPage';
import { serviceTitle } from '@/features/supervisor/api/services';
import { SUPERVISOR_API } from '@/features/supervisor/api/common';
import type { CustomerWorkspace } from './api';
import { customerWorkspacePath } from './paths';

export default function CustomerSummaryPage() {
  const { t } = useTranslation('executive');
  const { case: file, id, services, service_tabs } = useOutletContext<CustomerWorkspace>();
  if (!file) return null;
  return (
    <PageColumns
      asideLabel={t('workspace.notes')}
      aside={
        <Notebook url={`${SUPERVISOR_API}/cases/${String(file.id)}/notebook/`} name={file.name} />
      }
      main={
        <>
          <SectionCard id="customer-services" title={t('workspace.serviceTabs')} variant="panel">
            <ul className="m-0 list-none divide-y divide-hair p-0">
              {services.map((service) => (
                <li
                  key={service.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-2"
                >
                  <div>
                    <div className="font-semibold">{serviceTitle(service)}</div>
                    <div className="text-label text-text-2">
                      {service.owner?.name ?? t('customers.unassigned')}
                    </div>
                  </div>
                  {service_tabs.includes(service.id) && (
                    <Link
                      to={customerWorkspacePath(id, `desk/${String(service.id)}`)}
                      className={buttonClass('outline')}
                    >
                      {t('workspace.openService')}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </SectionCard>
          <CaseTasksCard data={file} />
          <CaseContract data={file} />
        </>
      }
    />
  );
}
