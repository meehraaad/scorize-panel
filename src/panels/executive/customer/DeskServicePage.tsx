import { useSuspenseQuery } from '@tanstack/react-query';
import { useOutletContext, useParams } from 'react-router';
import { CaseService } from '@/features/supervisor/CaseServicePage';
import { serviceQuery } from '@/features/supervisor/api/services';
import type { CustomerWorkspace } from './api';
import { CustomerSearchTool } from './CustomerSearchTool';
import { CustomerMailTool } from './CustomerMailTool';

export default function DeskServicePage() {
  const workspace = useOutletContext<CustomerWorkspace>();
  const service = Number(useParams().service);
  return workspace.case ? (
    <DeskService workspace={workspace} caseId={workspace.case.id} service={service} />
  ) : null;
}

function DeskService({
  workspace,
  caseId,
  service,
}: {
  workspace: CustomerWorkspace;
  caseId: number;
  service: number;
}) {
  const { data } = useSuspenseQuery(serviceQuery(caseId, service));
  const address = { customer: workspace.id, service };
  return (
    <CaseService
      name={workspace.name}
      caseId={caseId}
      detail={data}
      hideDefaultTool={data.service.kind === 'search'}
    >
      {data.service.kind === 'search' && <CustomerSearchTool address={address} />}
      {data.service.kind === 'correspondence' && <CustomerMailTool address={address} />}
    </CaseService>
  );
}
