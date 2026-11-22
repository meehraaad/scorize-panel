import { useSuspenseQuery } from '@tanstack/react-query';
import { Suspense, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, NavLink, Outlet } from 'react-router';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { BackLink } from '@/components/ui/BackLink';
import { buttonClass, tabClass } from '@/components/ui/buttonStyles';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageStack } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/SectionCard';
import { useFormat } from '@/lib/i18n/useFormat';
import { useDocumentTitle } from '@/lib/useDocumentTitle';
import { caseQuery, type CaseData } from './api';
import { BotProblems } from './components/BotProblems';
import { CaseHero } from './components/CaseHero';
import { StageDialog } from './components/StageDialog';
import { Chip } from '@/components/ui/Chip';
import { serviceTitle } from './api';
import { casePath, servicePath, supervisorPath, type CaseTab } from './paths';
import { useCaseId } from './useCaseId';

// Tickets have no tab: they open in the chat window (the case card's button).
const TABS: readonly CaseTab[] = ['', 'documents', 'applications', 'activity'];

/**
 * Frame of a case file: the summary card, the email bot's problems, the tabs (overview, documents,
 * email and applications, activity) and the stage dialog.
 * Design: canvas V1 "پرونده متقاضی" (SupervisorFile, SupervisorApplications), in the V6 look.
 */
export default function CaseLayout() {
  const id = useCaseId();
  if (!Number.isInteger(id) || id <= 0) return <Missing />;
  return <Loaded id={id} key={id} />;
}

function Loaded({ id }: { id: number }) {
  const { data } = useSuspenseQuery(caseQuery(id));
  return data ? <Case data={data} /> : <Missing />;
}

function Missing() {
  const { t } = useTranslation('supervisor');
  return (
    <PageStack>
      <PageHeader title={t('case.missingTitle')} />
      <EmptyState
        variant="card"
        action={
          <Link to={supervisorPath('files')} className={buttonClass('primary')}>
            {t('case.toList')}
          </Link>
        }
      >
        {t('case.missing')}
      </EmptyState>
    </PageStack>
  );
}

function Case({ data }: { data: CaseData }) {
  const { t } = useTranslation('supervisor');
  const f = useFormat();
  const [stageOpen, setStageOpen] = useState(false);
  useDocumentTitle(data.name);

  const badge: Partial<Record<CaseTab, { n: number; label: string }>> = {
    documents: { n: data.documents_waiting, label: t('case.tabs.waitingReview') },
  };
  const count: Partial<Record<CaseTab, number>> = { applications: data.applications };

  return (
    <PageStack>
      <BackLink to={supervisorPath('files')}>{t('case.back')}</BackLink>
      <CaseHero data={data} onStage={() => setStageOpen(true)} />
      <BotProblems caseId={data.id} problems={data.bot.problems} />
      <nav
        aria-label={t('case.tabs.label')}
        className="relative -mx-4 flex [scrollbar-width:none] gap-1.5 overflow-x-auto px-4 py-0.5 lg:mx-0 lg:px-0.5"
      >
        {TABS.map((tab) => {
          const waiting = badge[tab];
          const total = count[tab] ?? 0;
          return (
            <NavLink
              key={tab || 'overview'}
              to={casePath(data.id, tab)}
              end={tab === ''}
              className={({ isActive }) => tabClass(isActive)}
            >
              {t(`case.tabs.${tab || 'overview'}`)}
              {waiting && waiting.n > 0 && (
                <>
                  <Badge>{f.number(waiting.n)}</Badge>
                  <span className="sr-only">{waiting.label}</span>
                </>
              )}
              {total > 0 && (
                <span className="text-[13px] font-normal text-text-2">{f.number(total)}</span>
              )}
            </NavLink>
          );
        })}
      </nav>
      {data.services && data.services.length > 0 && (
        <nav
          aria-label={t('serviceTab.nav')}
          className="relative -mx-4 -mt-2 flex [scrollbar-width:none] gap-1.5 overflow-x-auto px-4 py-0.5 lg:mx-0 lg:px-0.5"
        >
          {data.services.map((service) => (
            <NavLink
              key={service.id}
              to={servicePath(data.id, service.id)}
              className={({ isActive }) => tabClass(isActive)}
            >
              {serviceTitle(service)}
              {!service.owner && service.status === 'open' && (
                <Chip tone="warn" small>
                  {t('services.noOwner')}
                </Chip>
              )}
            </NavLink>
          ))}
        </nav>
      )}
      {/* A tab's data must not hide the case card and its tabs. */}
      <Suspense fallback={<PageSkeleton kind="tab" />}>
        <Outlet />
      </Suspense>
      <StageDialog
        key={stageOpen ? `stage-${data.stage}` : 'stage-closed'}
        caseId={data.id}
        name={data.name}
        stage={data.stage}
        open={stageOpen}
        onClose={() => setStageOpen(false)}
      />
    </PageStack>
  );
}
