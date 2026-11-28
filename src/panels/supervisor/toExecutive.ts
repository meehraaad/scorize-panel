import { redirect, type LoaderFunctionArgs } from 'react-router';
import { caseQuery } from '@/features/supervisor/api';
import { queryClient } from '@/lib/api/queryClient';
import { getRoles } from '@/lib/auth/roles';
import { sessionQuery } from '@/lib/auth/session';
import { idParam } from '@/lib/router/lazyPage';
import { openCaseChat } from '@/lib/supervisor/caseChats';
import { customerWorkspacePath } from '../executive/customer/paths';

/** A case file's tab and the customer page's tab that shows the same. */
const TABS: Record<string, string> = {
  '': 'summary',
  documents: 'documents',
  applications: 'desk',
  activity: 'reports',
  tickets: 'summary',
};

/**
 * Links to a case file (`/supervisor/files/<case>/…`, in tasks, messages, the chat window and the
 * pages the executive panel shares with this one) open the customer's page in the executive panel
 * for anyone who works there. People without the executive panel keep the case file here.
 */
export async function caseFileToExecutive({ params, request }: LoaderFunctionArgs) {
  const id = idParam(params.id);
  if (id === null) return null;
  const user = await queryClient.query({ ...sessionQuery, staleTime: 'static' });
  if (!user || !getRoles(user).includes('executive')) return null;
  const file = await queryClient.query(caseQuery(id)).catch(() => null);
  if (!file) return null;

  const url = new URL(request.url);
  const rest = url.pathname.split(`/files/${String(id)}`)[1]?.replace(/^\/|\/$/g, '') ?? '';
  const [tab = '', ...more] = rest.split('/');
  let target = TABS[tab] ?? 'summary';
  if (tab === 'services' && idParam(more[0]) !== null) target = `desk/${more[0] ?? ''}`;
  // The old address of a conversation: the chat window opens on it over the customer's page.
  if (tab === 'tickets') openCaseChat(id, file.name, more.length > 0 ? more.join('/') : null);
  return redirect(`${customerWorkspacePath(file.user, target)}${url.search}`);
}
