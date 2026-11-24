import { useOutletContext } from 'react-router';
import CaseDocumentsPage from '@/features/supervisor/CaseDocumentsPage';
import { CaseContract } from '@/features/supervisor/CaseOverviewPage';
import type { CustomerWorkspace } from './api';

export default function CustomerDocumentsPage() {
  const { case: file } = useOutletContext<CustomerWorkspace>();
  return file ? <CaseDocumentsPage staffUpload extraFiles={<CaseContract data={file} />} /> : null;
}
