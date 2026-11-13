import { useEffect, useId, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { Notice } from '@/components/ui/Notice';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { SelectField } from '@/components/ui/Choices';
import { TextField } from '@/components/ui/TextField';
import { Pager } from '@/components/ui/Pager';
import { ApiError } from '@/lib/api/client';
import { toast } from '@/lib/toast';
import { DestinationFields } from './DestinationFields';
import { DestinationReport, DestinationReplay } from './DestinationReport';
import { CalculationResult } from './CalculatorResult';
import { snapshotsQuery, interviewQuery, isDestinationSnapshot } from './calculatorApi';
import {
  INTAKE_FIELDS,
  sameIntakeFact,
  destinationOptionsQuery,
  destinationQuery,
  startDestinationSession,
  saveDestinationAnswer,
  recordDestinations,
  type DestinationOptions,
  type IntakeInputs,
} from './destinationApi';

export default function DestinationPage() {
  const { t } = useTranslation('assessments');
  const section = useId();
  const cache = useQueryClient();
  const options = useQuery(destinationOptionsQuery);
  const [session, setSession] = useState('');
  const [date, setDate] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Record<string, unknown> | null>(null);
  const start = useMutation({
    mutationFn: (body: Record<string, unknown>) => startDestinationSession(body),
    onSuccess: (result) => {
      setPending(null);
      setSession(result.id);
      void cache.invalidateQueries({ queryKey: destinationOptionsQuery.queryKey });
    },
  });
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-5 p-4 sm:p-8">
      <PageHeader title={t('destinations.title')} subtitle={t('destinations.subtitle')} />
      <Notice tone="warn">{t('destinations.scope')}</Notice>
      {!options.data ? (
        <>
          <SkeletonRows rows={4} />
          {options.error && <Notice tone="error">{t('destinations.failed')}</Notice>}
        </>
      ) : (
        <>
          <SectionCard id={section} title={t('destinations.startTitle')} variant="panel">
            <div className="flex flex-col gap-4">
              <SelectField
                label={t('destinations.resume')}
                value={session}
                disabled={busy || start.isPending || Boolean(pending)}
                options={[
                  { value: '', label: t('calculator.choose') },
                  ...options.data.sessions.map((s, i) => ({
                    value: s.id,
                    label: t('destinations.sessionLabel', {
                      index: i + 1,
                      date: s.assessment_date,
                      revision: s.revision,
                    }),
                  })),
                ]}
                onChange={setSession}
              />
              <TextField
                type="date"
                label={t('destinations.assessmentDate')}
                max={options.data.today}
                value={date ?? options.data.today}
                disabled={busy || start.isPending || Boolean(pending)}
                onChange={(e) => setDate(e.target.value)}
              />
              {!options.data.catalog && <Notice tone="info">{t('destinations.noCatalog')}</Notice>}
              <Button
                disabled={
                  !options.data.catalog ||
                  busy ||
                  start.isPending ||
                  Boolean(pending) ||
                  !(date ?? options.data.today)
                }
                onClick={() => {
                  const body = {
                    request_key: crypto.randomUUID(),
                    assessment_date: date ?? options.data.today,
                    catalog_sha256: options.data.catalog?.sha256,
                  };
                  setPending(body);
                  start.mutate(body);
                }}
              >
                {t('destinations.start')}
              </Button>
              {start.error && (
                <Notice tone="error">
                  {t(
                    start.error instanceof ApiError && start.error.status === 409
                      ? 'destinations.conflict'
                      : 'destinations.failed',
                  )}
                </Notice>
              )}
              {pending && !start.isPending && (
                <>
                  <Button onClick={() => start.mutate(pending)}>{t('comparison.retry')}</Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setPending(null);
                      start.reset();
                      void options.refetch();
                    }}
                  >
                    {t('comparison.discardRequest')}
                  </Button>
                </>
              )}
            </div>
          </SectionCard>
          {session && (
            <IntakeEditor key={session} id={session} options={options.data} onBusy={setBusy} />
          )}
        </>
      )}
    </main>
  );
}
function IntakeEditor({
  id,
  options,
  onBusy,
}: {
  id: string;
  options: DestinationOptions;
  onBusy: (busy: boolean) => void;
}) {
  const { t } = useTranslation('assessments');
  const section = useId();
  const cache = useQueryClient();
  const query = useQuery(destinationQuery(id));
  const [page, setPage] = useState(1);
  const history = useQuery(snapshotsQuery(id, page));
  const [input, setInput] = useState<IntakeInputs | null>(null);
  const [pending, setPending] = useState<{
    kind: 'answer' | 'record';
    body: Record<string, unknown>;
  } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const mutation = useMutation({
    mutationFn: async (request: NonNullable<typeof pending>) => {
      if (request.kind === 'record') {
        await recordDestinations(id, request.body);
        void cache.invalidateQueries({ queryKey: ['calculator-snapshots', id] });
      } else {
        const next = await saveDestinationAnswer(id, request.body);
        cache.setQueryData(destinationQuery(id).queryKey, next.destinations);
        const field = request.body.field as keyof IntakeInputs | undefined;
        if (field)
          setInput((old) =>
            old ? { ...old, [field]: next.destinations.intake.inputs[field] } : null,
          );
        void cache.invalidateQueries({ queryKey: interviewQuery(id).queryKey });
        void cache.invalidateQueries({ queryKey: ['calculator-comparison', id] });
        void cache.invalidateQueries({ queryKey: ['calculator-snapshots', id] });
      }
    },
    onSuccess: () => {
      setPending(null);
      toast.success(t('destinations.saved'));
    },
  });
  const data = query.data;
  const dirty = Boolean(
    input &&
    data &&
    INTAKE_FIELDS.some((field) => !sameIntakeFact(input[field], data.intake.inputs[field])),
  );
  useEffect(() => {
    onBusy(dirty || Boolean(pending) || mutation.isPending || refreshing);
    return () => onBusy(false);
  }, [dirty, pending, mutation.isPending, refreshing, onBusy]);
  const conflict = mutation.error instanceof ApiError && mutation.error.status === 409;
  const locked =
    Boolean(query.error) ||
    query.isFetching ||
    mutation.isPending ||
    Boolean(pending) ||
    conflict ||
    refreshing ||
    !data?.writable;
  const send = (action: 'answer' | 'adopt' | 'record', field?: keyof IntakeInputs) => {
    if (!data) return;
    const fact = field ? (input ?? data.intake.inputs)[field] : undefined;
    const request = {
      kind: action === 'record' ? ('record' as const) : ('answer' as const),
      body: {
        revision: data.context.session_revision,
        decision_sha256: data.decision_sha256,
        request_key: crypto.randomUUID(),
        ...(action === 'record' ? {} : { action }),
        ...(field ? { field, status: fact?.status ?? 'unknown', value: fact?.value ?? null } : {}),
      },
    };
    setPending(request);
    mutation.mutate(request);
  };
  const refresh = async () => {
    setRefreshing(true);
    try {
      await query.refetch();
      mutation.reset();
    } finally {
      setRefreshing(false);
    }
  };
  return (
    <>
      <SectionCard id={section} title={t('destinations.intakeTitle')} variant="panel">
        <div className="flex min-w-0 flex-col gap-4">
          {!data && <SkeletonRows rows={5} />}
          {(query.error || mutation.error) && (
            <Notice tone="error">
              {t(conflict ? 'destinations.conflict' : 'destinations.failed')}
            </Notice>
          )}
          {mutation.isPaused && <Notice tone="warn">{t('calculator.offline')}</Notice>}
          <Button
            variant="outline"
            disabled={mutation.isPending || Boolean(pending) || refreshing}
            onClick={() => void refresh()}
          >
            {t('destinations.refresh')}
          </Button>
          {pending && !mutation.isPending && !conflict && (
            <Button onClick={() => mutation.mutate(pending)}>{t('comparison.retry')}</Button>
          )}
          {pending && !mutation.isPending && (
            <Button
              variant="outline"
              onClick={() => {
                setPending(null);
                void refresh();
              }}
            >
              {t('comparison.discardRequest')}
            </Button>
          )}
          {data && (
            <>
              <p>{t('destinations.provenance')}</p>
              {data.intake.catalog_changed && (
                <Notice tone="warn">{t('destinations.catalogChanged')}</Notice>
              )}
              {data.intake.active_catalog && (
                <Button variant="outline" disabled={locked || dirty} onClick={() => send('adopt')}>
                  {t('destinations.adopt')}
                </Button>
              )}
              <fieldset
                disabled={locked || data.intake.catalog_changed}
                className="m-0 flex min-w-0 flex-col gap-4 border-0 p-0"
              >
                <DestinationFields
                  countries={options.countries}
                  value={input ?? data.intake.inputs}
                  onChange={setInput}
                />
                {INTAKE_FIELDS.map((field) => (
                  <Button
                    key={field}
                    disabled={!input || sameIntakeFact(input[field], data.intake.inputs[field])}
                    onClick={() => send('answer', field)}
                  >
                    {t('destinations.saveField', { field: t(`destinations.fields.${field}`) })}
                  </Button>
                ))}
              </fieldset>
              {dirty && (
                <>
                  <Notice tone="warn">{t('calculator.unsaved')}</Notice>
                  <Button
                    variant="outline"
                    disabled={mutation.isPending || Boolean(pending)}
                    onClick={() => setInput(null)}
                  >
                    {t('destinations.discard')}
                  </Button>
                </>
              )}
              <DestinationReport data={data} />
              <Button
                disabled={locked || dirty || data.intake.catalog_changed}
                onClick={() => send('record')}
              >
                {t('destinations.record')}
              </Button>
            </>
          )}
        </div>
      </SectionCard>
      <SectionCard id={section + '-history'} title={t('calculator.history')} variant="panel">
        {history.isPending && <SkeletonRows rows={3} />}{' '}
        {history.data?.results.map((snapshot) => (
          <div key={snapshot.id}>
            <CalculationResult snapshot={snapshot} />
            {isDestinationSnapshot(snapshot) && <DestinationReplay snapshot={snapshot} />}
          </div>
        ))}
        {history.error && <Notice tone="error">{t('destinations.failed')}</Notice>}
        {history.data && (
          <Pager
            page={page}
            pages={Math.max(1, Math.ceil(history.data.count / history.data.page_size))}
            onPage={setPage}
          />
        )}
      </SectionCard>
    </>
  );
}
