import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip, type ChipTone } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { FilterTabs } from '@/components/ui/Filters';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { PageStack } from '@/components/ui/PageColumns';
import { Pager } from '@/components/ui/Pager';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { useFormat } from '@/lib/i18n/useFormat';
import {
  applicationsQuery,
  professorEmailsQuery,
  type CaseApplication,
  type Credential,
  type ProfessorEmailStatus,
} from './api';
import { pagesOf } from '@/lib/api/page';
import { ApplicationDialog } from './components/ApplicationDialog';
import { ApplicationTable } from './components/ApplicationTable';
import { BotBar } from './components/BotBar';
import { useCaseId } from './useCaseId';

type View = 'applications' | 'emails' | 'logins';

/**
 * The professor-email bot, the applications with their side editor, the emails the bot sent and
 * the application accounts. Canvas V1 "ایمیل و اپلای‌ها" (SupervisorApplications).
 */
export default function CaseApplicationsPage() {
  const { t } = useTranslation('supervisor');
  const f = useFormat();
  const id = useCaseId();
  const { data } = useSuspenseQuery(applicationsQuery(id));
  const [view, setView] = useState<View>('applications');
  // undefined: closed; null: a new application.
  const [editing, setEditing] = useState<CaseApplication | null | undefined>(undefined);

  return (
    <PageStack>
      <BotBar caseId={id} bot={data.bot} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterTabs
          label={t('applications.views')}
          value={view}
          onChange={setView}
          options={[
            {
              value: 'applications',
              label: t('applications.view.applications'),
              count: f.number(data.applications.length),
            },
            {
              value: 'emails',
              label: t('applications.view.emails'),
              count: f.number(data.emails.sent),
            },
            { value: 'logins', label: t('applications.view.logins') },
          ]}
        />
        {view === 'applications' && (
          <Button onClick={() => setEditing(null)}>
            <Icon name="plus" size={18} />
            {t('applications.add')}
          </Button>
        )}
      </div>

      {view === 'applications' && (
        <Card aria-label={t('applications.view.applications')}>
          <p className="m-0 px-5 pt-5 text-sm text-text-2 lg:px-8">
            {t('applications.applies', {
              used: f.number(data.applies.used),
              total: f.number(data.applies.total),
            })}
          </p>
          {data.applications.length === 0 ? (
            <EmptyState variant="padded">{t('applications.empty')}</EmptyState>
          ) : (
            <ApplicationTable applications={data.applications} onEdit={setEditing} />
          )}
        </Card>
      )}
      {view === 'emails' && <ProfessorEmails caseId={id} replied={data.emails.replied} />}
      {view === 'logins' && <Logins credentials={data.credentials} />}

      <ApplicationDialog
        key={editing === undefined ? 'closed' : `app-${String(editing?.id ?? 'new')}`}
        caseId={id}
        application={editing ?? null}
        open={editing !== undefined}
        onClose={() => setEditing(undefined)}
      />
    </PageStack>
  );
}

const EMAIL_TONE: Record<ProfessorEmailStatus, ChipTone> = {
  queued: 'neutral',
  sent: 'info',
  reminded: 'primary',
  replied: 'good',
  bounced: 'danger',
};

function ProfessorEmails({ caseId, replied }: { caseId: number; replied: number }) {
  const { t } = useTranslation('supervisor');
  const f = useFormat();
  const [page, setPage] = useState(1);
  const { data, isPlaceholderData } = useQuery(professorEmailsQuery(caseId, page));
  const pages = pagesOf(data);

  return (
    <Card aria-label={t('applications.view.emails')} aria-busy={!data || isPlaceholderData}>
      <p className="m-0 px-5 pt-5 text-sm text-text-2 lg:px-8">
        {t('emails.replied', { n: f.number(replied) })}
      </p>
      {!data ? (
        <SkeletonRows rows={5} />
      ) : data.results.length === 0 ? (
        <EmptyState variant="padded">{t('emails.empty')}</EmptyState>
      ) : (
        <ul className="m-0 list-none p-0 pt-2">
          {data.results.map((email) => (
            <li
              key={email.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3.5 shadow-[inset_0_1px_0_var(--hair)] lg:px-8"
            >
              <span className="flex min-w-0 flex-[1_1_240px] flex-col gap-0.5">
                <span className="text-[15px] font-semibold">
                  <bdi>{email.professor}</bdi>
                </span>
                <span className="text-[13px] text-text-2">
                  <bdi>{email.university}</bdi>
                </span>
              </span>
              <span className="flex-[0_0_140px] text-sm text-text-2">
                {email.sent_at ? f.date(email.sent_at) : t('dash')}
              </span>
              <Chip tone={EMAIL_TONE[email.status]} small>
                {t(`emails.status.${email.status}`)}
              </Chip>
            </li>
          ))}
        </ul>
      )}
      {data && data.count > 0 && (
        <Pager page={page} pages={pages} pending={isPlaceholderData} onPage={setPage} />
      )}
    </Card>
  );
}

/** The application accounts the team made: passwords hidden until asked, each value copyable. */
function Logins({ credentials }: { credentials: Credential[] }) {
  const { t } = useTranslation('supervisor');
  const [shown, setShown] = useState<ReadonlySet<string>>(new Set());
  const [copied, setCopied] = useState<string | null>(null);

  if (credentials.length === 0) return <EmptyState variant="card">{t('logins.empty')}</EmptyState>;

  const copy = (item: Credential) => {
    void navigator.clipboard
      .writeText(item.value)
      .then(() => setCopied(item.label))
      .catch(() => setCopied(null));
  };

  return (
    <Card aria-label={t('applications.view.logins')}>
      <p className="m-0 px-5 pt-5 text-sm leading-7 text-text-2 lg:px-8">{t('logins.hint')}</p>
      <dl className="m-0 pt-2">
        {credentials.map((item) => {
          const visible = !item.secret || shown.has(item.label);
          return (
            <div
              key={item.label}
              className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-2.5 shadow-[inset_0_1px_0_var(--hair)] lg:px-8"
            >
              <dt className="flex-[0_0_160px] text-sm text-text-2">{item.label}</dt>
              <dd className="m-0 flex min-w-0 flex-1 items-center gap-1">
                <span className="min-w-0 flex-1 truncate font-medium">
                  <bdi>{visible ? item.value : t('logins.hidden')}</bdi>
                </span>
                {item.secret && (
                  <IconButton
                    icon={visible ? 'eyeOff' : 'eye'}
                    tone="muted"
                    aria-label={t(visible ? 'logins.hide' : 'logins.show', { label: item.label })}
                    onClick={() =>
                      setShown((current) => {
                        const next = new Set(current);
                        if (next.has(item.label)) next.delete(item.label);
                        else next.add(item.label);
                        return next;
                      })
                    }
                  />
                )}
                <IconButton
                  icon={copied === item.label ? 'check' : 'document'}
                  tone="muted"
                  aria-label={t('logins.copy', { label: item.label })}
                  onClick={() => copy(item)}
                />
              </dd>
            </div>
          );
        })}
      </dl>
      <p aria-live="polite" className="sr-only">
        {copied ? t('logins.copied', { label: copied }) : ''}
      </p>
    </Card>
  );
}
