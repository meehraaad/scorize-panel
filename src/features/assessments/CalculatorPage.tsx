import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { SelectField } from '@/components/ui/Choices';
import { Notice } from '@/components/ui/Notice';
import { Pager } from '@/components/ui/Pager';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { ApiError } from '@/lib/api/client';
import { toast } from '@/lib/toast';
import { CalculationResult } from './CalculatorResult';
import { CalculatorReview } from './CalculatorReview';
import { CalculatorForm } from './CalculatorForm';
import {
  calculatorOptionsQuery,
  interviewQuery,
  snapshotsQuery,
  startCalculatorSession,
  saveCalculatorAnswer,
  recordCalculation,
  readyForAutosave,
  type Country,
  type AnswerStatus,
  type Options,
  type Interview,
  type Snapshot,
} from './calculatorApi';

function InterviewEditor({ id, options }: { id: string; options: Options }) {
  const { t } = useTranslation('assessments');
  const labels = t('calculator.fields', { returnObjects: true }) as Record<string, string>;
  const choicesText = t('calculator.choices', { returnObjects: true }) as Record<string, string>;
  const sectionId = useId();
  const cache = useQueryClient();
  const query = useQuery(interviewQuery(id));
  const [historyPage, setHistoryPage] = useState(1);
  const history = useQuery(snapshotsQuery(id, historyPage));
  const [country, setCountry] = useState<Country>('canada');
  const [field, setField] = useState('birth_date');
  const [status, setStatus] = useState<AnswerStatus | null>(null);
  const [value, setValue] = useState<unknown>(undefined);
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState<unknown>(null);
  const [autoPaused, setAutoPaused] = useState(false);
  const [snapshotRequest, setSnapshotRequest] = useState<unknown>(null);
  const [shown, setShown] = useState<Snapshot | null>(null);
  const data = query.data;
  const save = useMutation({
    mutationFn: (body: unknown) => saveCalculatorAnswer(id, body),
    onSuccess: (next) => {
      cache.setQueryData(interviewQuery(id).queryKey, (old: Interview | undefined) => ({
        ...old,
        ...next,
      }));
      void cache.invalidateQueries({ queryKey: ['calculator-snapshots', id] });
      setDirty(false);
      setAutoPaused(false);
      setPending(null);
      setShown(null);
      setSnapshotRequest(null);
      toast.success(t('calculator.saved'));
    },
    onError: () => setAutoPaused(true),
  });
  const { mutate: saveAnswer, isPending: saving, error: saveError } = save;
  const record = useMutation({
    mutationFn: () => {
      if (!data) throw new Error('Interview context unavailable');
      const body = snapshotRequest ?? {
        country,
        expected_revision: data.revision,
        expected_ruleset_hash: data.ruleset_sha256,
        expected_source_hash: data.sources[country].sha256,
        request_key: crypto.randomUUID(),
      };
      setSnapshotRequest(body);
      return recordCalculation(id, body);
    },
    onSuccess: (snapshot) => {
      setShown(snapshot);
      setHistoryPage(1);
      setSnapshotRequest(null);
      void cache.invalidateQueries({ queryKey: ['calculator-snapshots', id] });
    },
  });
  const current = data?.answers[options.identities[country][field] ?? ''];
  const answerStatus = status ?? current?.status ?? 'unknown';
  const answerValue = dirty ? value : current?.value;
  useEffect(() => {
    if (
      autoPaused ||
      !dirty ||
      !data ||
      saving ||
      saveError ||
      (answerStatus === 'known' && !readyForAutosave(options.schemas[country][field], answerValue))
    )
      return;
    const timer = setTimeout(() => {
      const body = pending ?? {
        country,
        field,
        adapter_version: data.adapter_version,
        revision: data.revision,
        request_key: crypto.randomUUID(),
        status: answerStatus,
        value: answerStatus === 'known' ? answerValue : null,
      };
      setPending(body);
      saveAnswer(body);
    }, 800);
    return () => clearTimeout(timer);
  }, [
    autoPaused,
    dirty,
    data,
    saving,
    saveError,
    saveAnswer,
    pending,
    country,
    field,
    answerStatus,
    answerValue,
    options.schemas,
  ]);
  if (!data)
    return (
      <>
        <SkeletonRows rows={4} />
        {query.error && <Notice tone="error">{t('calculator.failed')}</Notice>}
      </>
    );
  const fields = options.schemas[country];
  const choose = (nextCountry: Country, nextField: string) => {
    const answer = data.answers[options.identities[nextCountry][nextField] ?? ''];
    setCountry(nextCountry);
    setField(nextField);
    setStatus(answer?.status ?? 'unknown');
    setValue(answer?.value ?? undefined);
    setDirty(false);
    setPending(null);
    setShown(null);
    setSnapshotRequest(null);
    save.reset();
  };
  const conflict = saveError instanceof ApiError && saveError.status === 409;
  return (
    <>
      <SectionCard id={sectionId} title={t('calculator.interview')} variant="panel">
        <fieldset disabled={saving} className="m-0 flex flex-col gap-4 border-0 p-0">
          <SelectField
            label={t('calculator.country')}
            value={country}
            disabled={dirty || saving}
            options={(['canada', 'australia'] as const).map((key) => ({
              value: key,
              label: t(`calculator.choices.${key}`),
            }))}
            onChange={(next) => choose(next, Object.keys(options.schemas[next])[0] ?? '')}
          />
          <SelectField
            label={t('calculator.question')}
            value={field}
            disabled={dirty || saving}
            options={Object.keys(fields).map((key) => ({
              value: key,
              label: labels[key.replaceAll('.', '_')] ?? t('calculator.unknown'),
            }))}
            onChange={(next) => choose(country, next)}
          />
          <SelectField
            label={t('calculator.answerStatus')}
            value={answerStatus}
            disabled={saving}
            options={(['known', 'unknown', 'not_applicable', 'needs_confirmation'] as const).map(
              (key) => ({ value: key, label: t(`calculator.choices.${key}`) }),
            )}
            onChange={(next) => {
              setStatus(next);
              setValue(answerValue);
              setDirty(true);
              setPending(null);
              save.reset();
            }}
          />
          {answerStatus === 'known' && fields[field] && (
            <CalculatorForm
              schema={fields[field]}
              field={field}
              value={answerValue}
              onChange={(next) => {
                setValue(next);
                setDirty(true);
                setPending(null);
                save.reset();
              }}
            />
          )}
          {current && (
            <p>
              {t('calculator.provenance', {
                source: choicesText[current.source] ?? t('calculator.unknown'),
              })}
            </p>
          )}
          {dirty && <Notice tone="warn">{t('calculator.unsaved')}</Notice>}
          {save.isPaused && <Notice tone="warn">{t('calculator.offline')}</Notice>}
          {saveError && (
            <Notice tone="error">
              {t(conflict ? 'calculator.conflict' : 'calculator.failed')}
            </Notice>
          )}
          <Button
            disabled={!dirty || saving || conflict}
            onClick={() => {
              const body = pending ?? {
                country,
                field,
                adapter_version: data.adapter_version,
                revision: data.revision,
                request_key: crypto.randomUUID(),
                status: answerStatus,
                value: answerStatus === 'known' ? (answerValue ?? null) : null,
              };
              setPending(body);
              saveAnswer(body);
            }}
          >
            {t('calculator.save')}
          </Button>
          {conflict && (
            <Button
              variant="outline"
              onClick={() => {
                void query.refetch();
                save.reset();
                setPending(null);
              }}
            >
              {t('calculator.reload')}
            </Button>
          )}
          <Button
            variant="outline"
            disabled={dirty || saving || record.isPending}
            onClick={() => record.mutate()}
          >
            {t('calculator.record')}
          </Button>
          {record.error && <Notice tone="error">{t('calculator.failed')}</Notice>}
        </fieldset>
      </SectionCard>
      {shown && <CalculationResult snapshot={shown} />}
      <SectionCard id={sectionId + '-history'} title={t('calculator.history')} variant="panel">
        {history.data?.results.map((snapshot) => (
          <CalculationResult key={snapshot.id} snapshot={snapshot} />
        ))}
        {history.data && (
          <Pager
            page={historyPage}
            pages={Math.max(1, Math.ceil(history.data.count / history.data.page_size))}
            onPage={setHistoryPage}
          />
        )}
        {history.error && <Notice tone="error">{t('calculator.failed')}</Notice>}
      </SectionCard>
    </>
  );
}

export default function CalculatorPage() {
  const { t } = useTranslation('assessments');
  const sectionId = useId();
  const options = useQuery(calculatorOptionsQuery);
  const cache = useQueryClient();
  const [session, setSession] = useState('');
  const [reviewing, setReviewing] = useState(false);
  const [ruleset, setRuleset] = useState('');
  const [startKey, setStartKey] = useState(() => crypto.randomUUID());
  const start = useMutation({
    mutationFn: () => startCalculatorSession(Number(ruleset), startKey),
    onSuccess: (result) => {
      setSession(result.id);
      setStartKey(crypto.randomUUID());
      void cache.invalidateQueries({ queryKey: calculatorOptionsQuery.queryKey });
    },
  });
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-5 p-4 sm:p-8">
      <PageHeader title={t('calculator.title')} />
      <Notice tone="warn">{t('calculator.draft')}</Notice>
      {!options.data ? (
        <>
          <SkeletonRows rows={4} />
          {options.error && <Notice tone="error">{t('calculator.failed')}</Notice>}
        </>
      ) : (
        <>
          <SectionCard id={sectionId} title={t('calculator.session')} variant="panel">
            <div className="flex flex-col gap-4">
              <SelectField
                label={t('calculator.resume')}
                value={session}
                options={[
                  { value: '', label: t('calculator.choose') },
                  ...options.data.sessions.map((s, index) => ({
                    value: s.id,
                    label: t('calculator.sessionLabel', { index: index + 1, revision: s.revision }),
                  })),
                ]}
                onChange={setSession}
              />
              <SelectField
                label={t('calculator.ruleset')}
                value={ruleset}
                options={[
                  { value: '', label: t('calculator.choose') },
                  ...options.data.rulesets.map((r) => ({
                    value: String(r.id),
                    label: t('calculator.bundleLabel', { version: r.version }),
                  })),
                ]}
                onChange={setRuleset}
              />
              <Button disabled={!ruleset || start.isPending} onClick={() => start.mutate()}>
                {t('calculator.start')}
              </Button>
              {start.error && <Notice tone="error">{t('calculator.failed')}</Notice>}
            </div>
          </SectionCard>
          {session && <InterviewEditor key={session} id={session} options={options.data} />}
          {options.data.can_review && (
            <Button variant="outline" onClick={() => setReviewing(!reviewing)}>
              {t('calculator.reviewQueue')}
            </Button>
          )}
          {reviewing && <CalculatorReview options={options.data} />}
        </>
      )}
    </main>
  );
}
