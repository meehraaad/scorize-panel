import { useSuspenseQuery } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { Button } from '@/components/ui/Button';
import { buttonClass } from '@/components/ui/buttonStyles';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import { PageStack } from '@/components/ui/PageColumns';
import { SectionCard } from '@/components/ui/SectionCard';
import { hasPermission } from '@/lib/auth/roles';
import { useUser } from '@/lib/auth/session';
import { openCaseChat } from '@/lib/supervisor/caseChats';
import {
  applicationsQuery,
  ASSIGN_PERMISSION,
  caseQuery,
  serviceQuery,
  serviceTitle,
  type CaseApplication,
  type ServiceDetail,
} from './api';
import { ApplicationDialog } from './components/ApplicationDialog';
import { ApplicationTable } from './components/ApplicationTable';
import { BotBar } from './components/BotBar';
import { ProfessorEmails } from './components/ProfessorEmails';
import { OwnerDialog, StagePicker, VisaResults } from './components/ServicesCard';
import { casePath } from './paths';
import { useCaseId } from './useCaseId';

/**
 * One service's tab of a case file (SVC9): who owns it, its conversation, where it stands among
 * its stages, and the tool its kind works with. The tools are the panel's existing ones, gathered
 * under the service: admission = that country's applications, correspondence = the professors'
 * email bot, visa = the visa results. Mockup «خدمت‌ها» board Main.
 */
export default function CaseServicePage() {
  const id = useCaseId();
  const service = Number(useParams()['service']);
  const { data: file } = useSuspenseQuery(caseQuery(id));
  const { data } = useSuspenseQuery(serviceQuery(id, service));
  return <CaseService caseId={id} name={file?.name ?? ''} detail={data} />;
}

export function CaseService({
  caseId,
  name,
  detail,
  children,
  hideDefaultTool = false,
}: {
  caseId: number;
  name: string;
  detail: ServiceDetail;
  children?: ReactNode;
  hideDefaultTool?: boolean;
}) {
  const { t } = useTranslation('supervisor');
  const user = useUser();
  const manager = hasPermission(user, ASSIGN_PERMISSION);
  const [choosing, setChoosing] = useState(false);
  const { service } = detail;
  const title = serviceTitle(service);

  return (
    <PageStack>
      <SectionCard
        id="service-tab"
        variant="panel"
        title={title}
        badge={
          service.status === 'open' ? undefined : (
            <Chip tone="neutral" small>
              {t(service.status === 'paused' ? 'services.paused' : 'serviceTab.closed')}
            </Chip>
          )
        }
        subtitle={
          service.owner ? (
            t('serviceTab.owner', { name: service.owner.name })
          ) : (
            <Chip tone="warn" small>
              {t('services.noOwner')}
            </Chip>
          )
        }
        end={
          <span className="flex flex-wrap gap-2">
            <Button onClick={() => openCaseChat(caseId, name, `service/${String(service.id)}`)}>
              <Icon name="chat" size={18} />
              {t('serviceTab.conversation')}
            </Button>
            {manager && service.status !== 'closed' && (
              <Button variant="outline" onClick={() => setChoosing(true)}>
                {t(service.owner ? 'services.change' : 'services.choose', { service: title })}
              </Button>
            )}
          </span>
        }
      >
        <Stages detail={detail} />
        {detail.follows_case && (
          <p className="m-0 text-sm leading-6 text-text-2">{t('services.stage.followsCase')}</p>
        )}
        {detail.editable && <StagePicker caseId={caseId} detail={detail} />}
      </SectionCard>
      {children}
      {!hideDefaultTool && <Tool caseId={caseId} detail={detail} />}
      {choosing && (
        <OwnerDialog caseId={caseId} service={service} onClose={() => setChoosing(false)} />
      )}
    </PageStack>
  );
}

const STEP_STATES = ['done', 'now', 'ahead'] as const;

/** The kind's stages in order: done, where it is now, still ahead. */
function Stages({ detail }: { detail: ServiceDetail }) {
  const { t } = useTranslation('supervisor');
  if (detail.stages.length === 0) return null;
  const now = detail.stages.findIndex((stage) => stage.key === detail.service.stage?.key);
  return (
    <ol aria-label={t('serviceTab.stages')} className="m-0 flex list-none flex-wrap gap-2 p-0">
      {detail.stages.map((stage, index) => {
        const state = STEP_STATES[Math.sign(index - now) + 1] ?? STEP_STATES[2];
        return (
          <li
            key={stage.key}
            aria-current={state === 'now' ? 'step' : undefined}
            className={`flex min-h-11 items-center gap-2 rounded-full px-4 text-sm ${
              state === 'now'
                ? 'bg-primary font-semibold text-on-primary'
                : state === 'done'
                  ? 'bg-tint text-primary-text'
                  : 'text-text-2 shadow-[inset_0_0_0_1px_var(--line-2)]'
            }`}
          >
            {state === 'done' && <Icon name="check" size={16} />}
            {stage.name}
            {state !== 'now' && <span className="sr-only">{t(`serviceTab.state.${state}`)}</span>}
          </li>
        );
      })}
    </ol>
  );
}

/** The tool of the service's kind; a kind without one works by its stages alone. */
function Tool({ caseId, detail }: { caseId: number; detail: ServiceDetail }) {
  const { t } = useTranslation('supervisor');
  const { service } = detail;
  if (detail.visa)
    return (
      <Card className="p-5 lg:p-7">
        <VisaResults caseId={caseId} detail={detail} />
      </Card>
    );
  if (service.kind === 'admission') return <Admission caseId={caseId} detail={detail} />;
  if (service.kind === 'correspondence') return <Correspondence caseId={caseId} />;
  if (service.kind === 'search')
    return (
      <SectionCard id="service-tool" variant="panel" title={t('serviceTab.tool.search')}>
        <p className="m-0 text-sm leading-7 text-text-2">{t('serviceTab.searchSoon')}</p>
      </SectionCard>
    );
  return null;
}

/** An admission service: its country's applications, and adding one for that country. */
function Admission({ caseId, detail }: { caseId: number; detail: ServiceDetail }) {
  const { t } = useTranslation('supervisor');
  const { data } = useSuspenseQuery(applicationsQuery(caseId));
  const { service } = detail;
  // undefined: closed; null: a new application.
  const [editing, setEditing] = useState<CaseApplication | null | undefined>(undefined);
  // An older Django sends no country: every application is shown.
  const applications = data.applications.filter(
    (app) => app.country === undefined || !service.country || app.country === service.country,
  );

  return (
    <Card aria-labelledby="service-tool">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 pb-2 lg:px-8 lg:pt-7">
        <h2 id="service-tool" className="m-0 font-display text-xl font-bold">
          {service.country
            ? t('serviceTab.tool.admissionIn', { country: service.country })
            : t('serviceTab.tool.admission')}
        </h2>
        <span className="flex flex-wrap gap-2">
          <Link to={casePath(caseId, 'applications')} className={buttonClass('outline')}>
            {t('serviceTab.allApplications')}
          </Link>
          {service.status !== 'closed' && (
            <Button onClick={() => setEditing(null)}>
              <Icon name="plus" size={18} />
              {t('applications.add')}
            </Button>
          )}
        </span>
      </div>
      {applications.length === 0 ? (
        <EmptyState variant="padded">
          {service.country
            ? t('serviceTab.noApplications', { country: service.country })
            : t('applications.empty')}
        </EmptyState>
      ) : (
        <ApplicationTable applications={applications} onEdit={setEditing} />
      )}
      <ApplicationDialog
        key={editing === undefined ? 'closed' : `app-${String(editing?.id ?? 'new')}`}
        caseId={caseId}
        application={editing ?? null}
        {...(service.country ? { service: service.id } : {})}
        open={editing !== undefined}
        onClose={() => setEditing(undefined)}
      />
    </Card>
  );
}

/** A correspondence service: the professors' email bot of the case and the emails it sent. */
function Correspondence({ caseId }: { caseId: number }) {
  const { data } = useSuspenseQuery(applicationsQuery(caseId));
  return (
    <>
      <BotBar caseId={caseId} bot={data.bot} />
      <ProfessorEmails caseId={caseId} replied={data.emails.replied} />
    </>
  );
}
