import { redirect, type LoaderFunctionArgs } from 'react-router';
import {
  SUPERVISOR_API,
  activityQuery,
  applicationsQuery,
  caseQuery,
  documentsQuery,
  serviceQuery,
} from '@/features/supervisor/api';
import { orderQuery } from '@/features/writer/api';
import { queryClient } from '@/lib/api/queryClient';
import { getRoles } from '@/lib/auth/roles';
import { sessionQuery } from '@/lib/auth/session';
import { notebookQuery } from '@/lib/notes/api';
import { idParam, prefetchQueries, type PageQuery } from '@/lib/router/lazyPage';
import {
  customerReportQuery,
  customerTasksQuery,
  financeQuery,
  workspaceInfoQuery,
  workspaceQuery,
  type CustomerWorkspace,
} from './api';
import { customerWorkspacePath } from './paths';
import { mailWorkspaceQuery, searchWorkspaceQuery } from './serviceToolsApi';

type Page =
  | 'frame'
  | 'desk'
  | 'service'
  | 'tasks'
  | 'summary'
  | 'contract'
  | 'information'
  | 'documents'
  | 'reports';

export type WorkspaceLoader = (page: Page, args: LoaderFunctionArgs) => Promise<Response | null>;

function serviceQueries(workspace: CustomerWorkspace, value: string | undefined): PageQuery[] {
  if (value === 'writing') {
    const id = workspace.writing[0]?.id;
    return id === undefined ? [] : [orderQuery(id)];
  }
  const service = idParam(value);
  if (!workspace.case || service === null || !workspace.service_tabs.includes(service)) return [];
  const kind = workspace.services.find((item) => item.id === service)?.kind;
  const address = { customer: workspace.id, service };
  const queries: PageQuery[] = [serviceQuery(workspace.case.id, service)];
  if (kind === 'search') queries.push(searchWorkspaceQuery(address));
  if (kind === 'correspondence') queries.push(mailWorkspaceQuery(address));
  if (kind === 'admission' || kind === 'correspondence')
    queries.push(applicationsQuery(workspace.case.id));
  return queries;
}

export const loadWorkspacePage: WorkspaceLoader = async (page, { params }) => {
  const id = idParam(params.id);
  if (id === null) return null;
  const user = await queryClient.query({ ...sessionQuery, staleTime: 'static' });
  if (!user || !getRoles(user).includes('executive')) return null;

  const workspace = await queryClient.query(workspaceQuery(id));
  if (!workspace) return null;
  const file = workspace.case;
  if (file) {
    const { queryKey } = caseQuery(file.id);
    if (!queryClient.getQueryData(queryKey)) queryClient.setQueryData(queryKey, file);
  }

  if (page === 'frame') return null;
  if (page === 'desk') {
    const services = workspace.services.filter(({ id }) => workspace.service_tabs.includes(id));
    const owned = services.find(({ owner }) => owner?.id === user.staff?.id);
    const service = owned?.id ?? (workspace.writing.length > 0 ? 'writing' : services[0]?.id);
    if (service !== undefined)
      return redirect(customerWorkspacePath(id, `desk/${String(service)}`));
    if (file) prefetchQueries([applicationsQuery(file.id)]);
  } else if (page === 'service') {
    prefetchQueries(serviceQueries(workspace, params.service));
  } else if (page === 'tasks') {
    prefetchQueries([customerTasksQuery(id, 'open', 1)]);
  } else if (file) {
    const requests = {
      summary: [notebookQuery(`${SUPERVISOR_API}/cases/${String(file.id)}/notebook/`)],
      contract: [financeQuery(id)],
      information: [workspaceInfoQuery(id)],
      documents: [documentsQuery(file.id)],
      reports: [customerReportQuery(id), activityQuery(file.id, 1)],
    };
    prefetchQueries(requests[page]);
  } else {
    return redirect(customerWorkspacePath(id, 'desk'));
  }
  return null;
};
