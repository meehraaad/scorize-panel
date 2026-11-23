import { useSuspenseQuery } from '@tanstack/react-query';
import { useOutletContext } from 'react-router';
import { CustomerInfoEditor } from '@/features/sales/CustomerInfoPage';
import { workspaceInfoQuery, workspaceInfoSource, type CustomerWorkspace } from './api';

export default function CustomerInformationPage() {
  const workspace = useOutletContext<CustomerWorkspace>();
  return workspace.case ? <CustomerInformation workspace={workspace} /> : null;
}

function CustomerInformation({ workspace }: { workspace: CustomerWorkspace }) {
  const { id, can_edit_information: canEdit } = workspace;
  const { data } = useSuspenseQuery(workspaceInfoQuery(id));
  return (
    <CustomerInfoEditor
      key={id}
      id={id}
      initial={data}
      source={workspaceInfoSource(id)}
      readOnly={!canEdit}
    />
  );
}
