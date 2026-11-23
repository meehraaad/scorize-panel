import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { FilterTabs } from '@/components/ui/Filters';
import InboxPage from '@/features/supervisor/InboxPage';
import { orderPath } from '@/features/writer/paths';
import { getRoles } from '@/lib/auth/roles';
import { useUser } from '@/lib/auth/session';
import type { WritingDepartment } from '@/lib/tickets/api';
import { caseInboxQuery, ticketDepartment, writingInboxQuery } from './tickets';

export default function ExecutiveTicketsPage() {
  const { t } = useTranslation(['executive', 'writer']);
  const roles = getRoles(useUser());
  const [search, setSearch] = useSearchParams();
  const department = ticketDepartment(roles, search);
  const controls = roles.includes('writer') && roles.includes('supervisor') && (
    <FilterTabs
      label={t('department')}
      options={[
        { value: 'cases', label: t('caseServices') },
        { value: 'writing', label: t('writing') },
      ]}
      value={department}
      onChange={(value) => setSearch(value === 'writing' ? { department: value } : {})}
    />
  );
  return department === 'writing' ? (
    <InboxPage
      key="writing"
      controls={controls}
      query={writingInboxQuery}
      threadLabel={(item) =>
        item.thread
          ? t(`writer:type.${item.thread.slice('writing/'.length) as WritingDepartment}`)
          : t('writing')
      }
      threadPath={(item) => orderPath(item.applicant.id, 'tickets')}
      detailPath={(item) => orderPath(item.applicant.id)}
    />
  ) : (
    <InboxPage
      key="cases"
      controls={controls}
      query={caseInboxQuery}
      threadLabel={(item) => item.thread_name ?? t('general')}
    />
  );
}
