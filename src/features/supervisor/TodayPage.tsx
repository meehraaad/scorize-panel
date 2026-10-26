import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { QuerySection } from '@/components/ui/QuerySection';
import { Pager } from '@/components/ui/Pager';
import { pagesOf, useClampPage } from '@/lib/api/page';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { buttonClass, tabClass } from '@/components/ui/buttonStyles';
import { PageStack } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import { useUser } from '@/lib/auth/session';
import { useFormat } from '@/lib/i18n/useFormat';
import { todayBoardQuery, todayWaitingQuery, todayCountsQuery, type CaseStage } from './api';
import { DeadlineBoard } from './components/DeadlineBoard';
import { WaitingList } from './components/WaitingList';
import { casesPath, supervisorPath } from './paths';

/** Stages linked under the list (the busy ones). */
const STAGE_LINKS: readonly CaseStage[] = ['applying', 'documents', 'writing', 'admitted'];

/**
 * The supervisor's home: deadlines in the next two weeks, then the cases that wait on them.
 * Design: canvas V5 "سوپروایزر · امروز" (SupervisorV5), in the V6 look.
 */
export default function TodayPage() {
  const { t } = useTranslation('supervisor');
  const f = useFormat();
  const user = useUser();
  const [boardPage, setBoardPage] = useState(1);
  const [waitingPage, setWaitingPage] = useState(1);
  const board = useQuery(todayBoardQuery(boardPage));
  const waitingQuery = useQuery(todayWaitingQuery(waitingPage));
  const counts = useQuery(todayCountsQuery);
  useClampPage(board.data, boardPage, setBoardPage);
  useClampPage(waitingQuery.data, waitingPage, setWaitingPage);
  const name = user.first_name || user.staff?.full_name || '';
  const waiting = waitingQuery.data?.count ?? 0;

  return (
    <PageStack>
      <PageHeader
        title={
          !waitingQuery.data
            ? t('today.greeting', { name })
            : waiting > 0
              ? t('today.title', { name, n: f.number(waiting) })
              : t('today.titleClear', { name })
        }
        subtitle={t('today.board.window')}
        actions={
          <Link to={supervisorPath('files')} className={buttonClass('outline')}>
            {t('today.allCases')}
          </Link>
        }
      />
      <QuerySection
        pending={board.isPending}
        error={board.error}
        retry={() => {
          void board.refetch();
        }}
      >
        <DeadlineBoard items={board.data?.results ?? []} />
        <Pager page={boardPage} pages={pagesOf(board.data)} onPage={setBoardPage} />
      </QuerySection>
      <QuerySection
        pending={waitingQuery.isPending}
        error={waitingQuery.error}
        retry={() => {
          void waitingQuery.refetch();
        }}
      >
        <WaitingList cases={waitingQuery.data?.results ?? []} />
        <Pager page={waitingPage} pages={pagesOf(waitingQuery.data)} onPage={setWaitingPage} />
      </QuerySection>
      <QuerySection
        pending={counts.isPending}
        error={counts.error}
        retry={() => {
          void counts.refetch();
        }}
      >
        <nav aria-label={t('today.byStage')} className="flex flex-wrap gap-1.5">
          {STAGE_LINKS.map((stage) => (
            <Link key={stage} to={casesPath(stage)} className={tabClass(false)}>
              {t(`stage.${stage}`)}
              <span className="text-[13px] font-normal text-text-2">
                {f.number(counts.data?.[stage] ?? 0)}
              </span>
            </Link>
          ))}
        </nav>
      </QuerySection>
    </PageStack>
  );
}
