import { useState, type SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Button } from '@/components/ui/Button';
import { buttonClass } from '@/components/ui/buttonStyles';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Dialog } from '@/components/ui/Dialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import { LazyDatePicker } from '@/components/ui/LazyDatePicker';
import { Notice } from '@/components/ui/Notice';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageStack } from '@/components/ui/PageColumns';
import { Row, RowList } from '@/components/ui/RowList';
import { SectionCard } from '@/components/ui/SectionCard';
import { TextField } from '@/components/ui/TextField';
import { requestPath } from '@/lib/execution/paths';
import { toast } from '@/lib/toast';
import { useExecution } from './context';
import { caseFile, nextActor, openRequest, type Criteria } from './data';
import { CaseLink, DateText, Details, PhaseChip, ProgramText, Responsibility } from './Details';

export default function AdmissionPage() {
  const { t } = useTranslation(['execution', 'common']);
  const { state, role } = useExecution();
  const [creating, setCreating] = useState(false);
  const request = openRequest(state);
  const canCreate = role === caseFile.admissionOwner && !request;
  const actor = request
    ? nextActor[request.phase]
    : state.requests.length
      ? null
      : caseFile.admissionOwner;

  return (
    <PageStack>
      <PageHeader title={t('admission')} subtitle={<CaseLink />} />
      <Card className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4 border-s-4 border-primary p-5 lg:p-6">
        <div className="flex min-w-0 flex-col gap-2">
          <h2 className="m-0 text-xs font-bold text-primary-text">{t('nextStep')}</h2>
          <p className="m-0 font-display text-lg leading-8 font-bold">
            {t(`statuses.${request?.phase ?? (state.requests.length ? 'added' : 'idle')}`)}
          </p>
          <Responsibility owner={caseFile.admissionOwner} actor={actor} />
        </div>
        {canCreate && (
          <Button className="max-sm:w-full" onClick={() => setCreating(true)}>
            <Icon name="plus" size={18} />
            {t('newRequest')}
          </Button>
        )}
        {request && (
          <Link to={requestPath(request.id)} className={buttonClass('primary', 'max-sm:w-full')}>
            {t(
              request.phase === 'review' && role === caseFile.admissionOwner
                ? 'reviewRequest'
                : 'openRequest',
            )}
            <Icon name="chevronEnd" size={18} />
          </Link>
        )}
      </Card>
      <SectionCard
        id="execution-applications"
        title={t('applications')}
        subtitle={t('applicationsNote')}
      >
        <RowList>
          {state.applications.map((application) => (
            <Row key={application.id}>
              <div className="grid w-full min-w-0 gap-x-5 gap-y-3 py-1 sm:grid-cols-[minmax(0,1fr)_minmax(135px,auto)_minmax(100px,auto)] sm:items-center">
                <ProgramText option={application} />
                <Details
                  rows={[
                    { label: t('programDue'), value: <DateText date={application.deadline} /> },
                  ]}
                />
                <div className="sm:justify-self-end">
                  {application.id === 'existing-application' ? (
                    <Chip tone="neutral" dot>
                      {t('applicationDraft')}
                    </Chip>
                  ) : (
                    <Chip tone="good" dot>
                      {t('applicationReady')}
                    </Chip>
                  )}
                </div>
              </div>
            </Row>
          ))}
        </RowList>
      </SectionCard>
      <SectionCard id="execution-search-history" title={t('searchRequests')}>
        {state.requests.length === 0 ? (
          <EmptyState>{t('noRequest')}</EmptyState>
        ) : (
          <RowList>
            {state.requests.map((item) => (
              <Row key={item.id}>
                <div className="flex w-full min-w-0 flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 flex-col">
                    <Link
                      to={requestPath(item.id)}
                      className="inline-flex min-h-11 items-center self-start font-bold [overflow-wrap:anywhere] text-primary-text hover:underline"
                    >
                      {item.criteria.field}
                    </Link>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm leading-6 text-text-2">
                      <span>{item.criteria.degree}</span>
                      <span>
                        {t('requestDue')} <DateText date={item.criteria.due} />
                      </span>
                    </div>
                  </div>
                  <PhaseChip phase={item.phase} />
                </div>
              </Row>
            ))}
          </RowList>
        )}
      </SectionCard>
      {creating && <NewRequest onClose={() => setCreating(false)} />}
    </PageStack>
  );
}

function NewRequest({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation(['execution', 'common']);
  const { state, dispatch } = useExecution();
  const [criteria, setCriteria] = useState<Criteria>(state.draft);
  const [invalid, setInvalid] = useState(false);

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!criteria.field.trim() || !criteria.degree.trim() || !criteria.due) {
      setInvalid(true);
      return;
    }
    dispatch({ type: 'create', id: crypto.randomUUID(), criteria });
    toast.success(t('feedback.created'));
    onClose();
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={t('newRequest')}
      subtitle={caseFile.name}
      closeLabel={t('common:more.close')}
      footer={
        <Button type="submit" form="execution-create-request" className="w-full">
          {t('create')}
        </Button>
      }
    >
      <form id="execution-create-request" onSubmit={submit} className="flex flex-col gap-4">
        {invalid && <Notice tone="error">{t('errors.required')}</Notice>}
        <TextField
          label={t('field')}
          value={criteria.field}
          maxLength={150}
          required
          onChange={(event) => setCriteria({ ...criteria, field: event.target.value })}
        />
        <TextField
          label={t('degree')}
          value={criteria.degree}
          maxLength={100}
          required
          onChange={(event) => setCriteria({ ...criteria, degree: event.target.value })}
        />
        <LazyDatePicker
          label={t('requestDue')}
          value={criteria.due}
          onChange={(due) => setCriteria({ ...criteria, due })}
        />
      </form>
    </Dialog>
  );
}
