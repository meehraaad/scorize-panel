import { useState, type SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';
import { BackLink } from '@/components/ui/BackLink';
import { Button } from '@/components/ui/Button';
import { ChoiceGroup } from '@/components/ui/Choices';
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
import { ADMISSION_PATH } from '@/lib/execution/paths';
import { toast } from '@/lib/toast';
import { useExecution } from './context';
import { caseFile, hasProgram, nextActor, people, type ProgramDetails, type Request } from './data';
import { CaseLink, DateText, Details, PhaseChip, ProgramText, Responsibility } from './Details';

export default function SearchPage() {
  const { t } = useTranslation(['execution', 'common']);
  const { requestId } = useParams();
  const { state } = useExecution();
  const request = state.requests.find((item) => item.id === requestId);

  return (
    <PageStack>
      <BackLink to={ADMISSION_PATH}>{t('admission')}</BackLink>
      <PageHeader title={t('search')} subtitle={<CaseLink />} />
      {request ? (
        <SearchRequest request={request} />
      ) : (
        <EmptyState variant="card">{t('requestMissing')}</EmptyState>
      )}
    </PageStack>
  );
}

function SearchRequest({ request }: { request: Request }) {
  const { t } = useTranslation(['execution', 'common']);
  const { role, dispatch, openApplicant } = useExecution();
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const researching = role === caseFile.searchOwner && request.phase === 'searching';
  const reviewing = role === caseFile.admissionOwner && request.phase === 'review';
  const actor = nextActor[request.phase];
  const { id } = request;

  return (
    <>
      <SectionCard
        id="execution-criteria"
        title={t('criteria')}
        variant="panel"
        end={<PhaseChip phase={request.phase} />}
      >
        <Details
          rows={[
            { label: t('field'), value: request.criteria.field },
            { label: t('degree'), value: request.criteria.degree },
            { label: t('requestDue'), value: <DateText date={request.criteria.due} /> },
            { label: t('requestedBy'), value: people[caseFile.admissionOwner] },
          ]}
        />
        <div className="border-t border-hair pt-3">
          <Responsibility owner={caseFile.searchOwner} actor={actor} />
        </div>
      </SectionCard>

      <SectionCard id="execution-options" title={t('options')}>
        {request.options.length === 0 && <EmptyState>{t('noOptions')}</EmptyState>}
        {reviewing ? (
          <div className="px-5 py-3 [overflow-wrap:anywhere] lg:px-8">
            <ChoiceGroup
              look="cards"
              legend={t('selectOption')}
              value={selected}
              onChange={setSelected}
              options={request.options.map((option) => ({
                value: option.id,
                label: option.university,
                hint: option.program,
                extra: (
                  <span className="text-xs leading-6 text-text-2">
                    {t('programDue')} <DateText date={option.deadline} />
                  </span>
                ),
              }))}
            />
          </div>
        ) : (
          <RowList>
            {request.options.map((option) => (
              <Row key={option.id}>
                <div className="flex w-full min-w-0 flex-wrap items-center justify-between gap-x-6 gap-y-3 py-1">
                  <ProgramText option={option} />
                  <Details
                    rows={[{ label: t('programDue'), value: <DateText date={option.deadline} /> }]}
                  />
                  {option.id === request.sharedId && <PhaseChip phase={request.phase} />}
                </div>
              </Row>
            ))}
          </RowList>
        )}
        {researching && (
          <div className="flex flex-wrap gap-3 px-5 pb-5 lg:px-8">
            {request.options.length > 0 && (
              <Button
                className="max-sm:w-full"
                onClick={() => {
                  dispatch({ type: 'deliver', id });
                  toast.success(t('feedback.delivered'));
                }}
              >
                <Icon name="check" size={18} />
                {t('deliver')}
              </Button>
            )}
            <Button
              variant={request.options.length ? 'outline' : 'primary'}
              className="max-sm:w-full"
              onClick={() => setAdding(true)}
            >
              <Icon name="plus" size={18} />
              {t('addOption')}
            </Button>
          </div>
        )}
        {reviewing && (
          <div className="px-5 pt-2 pb-5 lg:px-8">
            <Button
              disabled={!selected}
              className="max-sm:w-full"
              onClick={() => {
                if (!selected) return;
                dispatch({ type: 'share', id, optionId: selected });
                toast.success(t('feedback.sent'));
              }}
            >
              <Icon name="send" size={18} />
              {t('send')}
            </Button>
          </div>
        )}
        {request.phase === 'sent' && role === caseFile.admissionOwner && (
          <div className="px-5 pb-5 lg:px-8">
            <Button variant="outline" className="max-sm:w-full" onClick={openApplicant}>
              <Icon name="eye" size={18} />
              {t('previewApplicant')}
            </Button>
          </div>
        )}
        {request.phase === 'approved' && role === caseFile.admissionOwner && (
          <div className="px-5 pb-5 lg:px-8">
            <Button
              className="max-sm:w-full"
              onClick={() => {
                dispatch({ type: 'apply', id });
                toast.success(t('feedback.added'));
              }}
            >
              <Icon name="plus" size={18} />
              {t('addApproved')}
            </Button>
          </div>
        )}
      </SectionCard>
      {adding && <OptionDialog request={request} onClose={() => setAdding(false)} />}
    </>
  );
}

function OptionDialog({ request, onClose }: { request: Request; onClose: () => void }) {
  const { t } = useTranslation(['execution', 'common']);
  const { dispatch } = useExecution();
  const [option, setOption] = useState<ProgramDetails>({
    university: '',
    program: '',
    deadline: '',
  });
  const [error, setError] = useState<'required' | 'duplicate' | null>(null);

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!option.university.trim() || !option.program.trim() || !option.deadline) {
      setError('required');
      return;
    }
    if (hasProgram(request.options, option)) {
      setError('duplicate');
      return;
    }
    dispatch({ type: 'option', id: request.id, option: { ...option, id: crypto.randomUUID() } });
    toast.success(t('feedback.option'));
    onClose();
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={t('addOption')}
      closeLabel={t('common:more.close')}
      footer={
        <Button type="submit" form="execution-add-option" className="w-full">
          {t('addOption')}
        </Button>
      }
    >
      <form id="execution-add-option" onSubmit={submit} className="flex flex-col gap-4">
        {error && <Notice tone="error">{t(`errors.${error}`)}</Notice>}
        <TextField
          label={t('university')}
          value={option.university}
          dir="auto"
          maxLength={160}
          required
          onChange={(event) => setOption({ ...option, university: event.target.value })}
        />
        <TextField
          label={t('program')}
          value={option.program}
          dir="auto"
          maxLength={160}
          required
          onChange={(event) => setOption({ ...option, program: event.target.value })}
        />
        <LazyDatePicker
          label={t('programDue')}
          value={option.deadline}
          onChange={(deadline) => setOption({ ...option, deadline })}
        />
      </form>
    </Dialog>
  );
}
