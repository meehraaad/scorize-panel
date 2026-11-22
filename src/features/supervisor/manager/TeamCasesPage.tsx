import { CaseList } from '../CasesPage';

/** The manager's list of every case, with each case's supervisors (`cases/?scope=all`). */
export default function TeamCasesPage() {
  return <CaseList team />;
}
