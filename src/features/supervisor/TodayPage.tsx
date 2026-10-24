import { useSuspenseQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { buttonClass, tabClass } from '@/components/ui/buttonStyles';
import { PageStack } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import { useUser } from '@/lib/auth/session';
import { daysUntil } from '@/lib/dates';
import { useFormat } from '@/lib/i18n/useFormat';
import { todayQuery, type CaseStage } from './api';
import { DeadlineBoard, URGENT_DAYS } from './components/DeadlineBoard';
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
  const { data } = useSuspenseQuery(todayQuery);
  const name = user.first_name || user.staff?.full_name || '';
  const waiting = data.waiting.length;
  const soon = data.board.filter(
    (item) => item.status !== 'submitted' && daysUntil(item.deadline) <= URGENT_DAYS,
  ).length;

  return (
    <PageStack>
      <PageHeader
        title={
          waiting > 0
            ? t('today.title', { name, n: f.number(waiting) })
            : t('today.titleClear', { name })
        }
        subtitle={soon > 0 ? t('today.subtitle', { n: f.number(soon) }) : t('today.subtitleCalm')}
        actions={
          <Link to={supervisorPath('files')} className={buttonClass('outline')}>
            {t('today.allCases')}
          </Link>
        }
      />
      <DeadlineBoard items={data.board} />
      <WaitingList cases={data.waiting} />
      <nav aria-label={t('today.byStage')} className="flex flex-wrap gap-1.5">
        {STAGE_LINKS.map((stage) => (
          <Link key={stage} to={casesPath(stage)} className={tabClass(false)}>
            {t(`stage.${stage}`)}
            <span className="text-[13px] font-normal text-text-2">
              {f.number(data.counts[stage])}
            </span>
          </Link>
        ))}
      </nav>
    </PageStack>
  );
}
