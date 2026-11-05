import { useSuspenseQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Navigate, useParams } from 'react-router';
import { caseQuery } from '@/features/supervisor/api';
import { casePath } from '@/features/supervisor/paths';
import { openCaseChat } from '@/lib/supervisor/caseChats';

/**
 * The old address of a case's tickets (`files/<id>/tickets[/<thread>]`, still in notifications and
 * messages): opens the chat window on that thread over the case file.
 */
export default function CaseTicketsPage() {
  const params = useParams();
  const id = Number(params.id);
  const thread = params['*'] || null;
  const { data } = useSuspenseQuery(caseQuery(id));
  const name = data?.name;

  useEffect(() => {
    if (name !== undefined) openCaseChat(id, name, thread);
  }, [id, name, thread]);

  return <Navigate to={casePath(id)} replace />;
}
