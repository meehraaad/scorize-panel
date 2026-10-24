import { useSuspenseQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { PageColumns, PageStack } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import { accessQuery } from '@/lib/applicant/access';
import { useUser } from '@/lib/auth/session';
import { useFormat } from '@/lib/i18n/useFormat';
import { overviewQuery } from './api';
import { CaseHero } from './components/CaseHero';
import { CaseSummary } from './components/CaseSummary';
import { DeadlinesCard } from './components/DeadlinesCard';
import { GuestHome } from './components/GuestHome';
import { TicketCard } from './components/TicketCard';
import { TodoCard } from './components/TodoCard';

/**
 * "My case": the applicant panel's home. Design: canvas V6 "پرونده من" (AppHome); without an
 * active contract, the guest home of canvas V7 section 2.
 */
export default function HomePage() {
  const { t } = useTranslation('home');
  const f = useFormat();
  const user = useUser();
  const { data: access } = useSuspenseQuery(accessQuery);
  const { data } = useSuspenseQuery(overviewQuery);

  // No contract, or one still in review: canvas V7 section 2. No applicant file (404) is a guest.
  if (access.state === 'pending') return <GuestHome access={access} />;
  if (!data || access.state === 'guest')
    return <GuestHome access={{ ...access, state: 'guest' }} />;

  const stage = t(`stage.${data.file.stage}.name`);
  const title = user.first_name
    ? t('title', { name: user.first_name, stage })
    : t('titleNoName', { stage });
  const subtitle = [
    t('summary', {
      submitted: f.number(data.stats.submitted),
      accepted: f.number(data.stats.accepted),
    }),
    data.todos.length > 0 && t('summaryTodos', { n: f.number(data.todos.length) }),
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <PageStack>
      <PageHeader title={title} subtitle={subtitle} />
      <CaseHero file={data.file} />
      <PageColumns
        asideLabel={t('aside')}
        main={
          <>
            <TodoCard todos={data.todos} />
            <TicketCard ticket={data.ticket} />
            <DeadlinesCard deadlines={data.deadlines} />
          </>
        }
        aside={<CaseSummary data={data} />}
      />
    </PageStack>
  );
}
