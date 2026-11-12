import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useRef, useState } from 'react';
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
import { ProfileEvidence } from './ProfileEvidence';
import { RouteComparison } from './RouteComparison';
import { GuidedInterview } from './GuidedInterview';
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
  type ProfileCandidate,
} from './calculatorApi';

function InterviewEditor({ id, options }: { id: string; options: Options }) {
  const { t } = useTranslation('assessments');
  const labels = t('calculator.fields', { returnObjects: true }) as Record<string, string>;
  const choicesText = t('calculator.choices', { returnObjects: true }) as Record<string, string>;
  const sectionId = useId();
  const editorRef = useRef<HTMLFieldSetElement>(null);
  const hasNavigated = useRef(false);
  const focusEditor = () =>
    requestAnimationFrame(() => {
      editorRef.current?.scrollIntoView({ block: 'start' });
      editorRef.current?.focus({ preventScroll: true });
    });
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
  const [profileCandidate, setProfileCandidate] = useState<ProfileCandidate | null>(null);
  const [guidanceDecision, setGuidanceDecision] = useState<string | null>(null);
  const [guidanceBusy, setGuidanceBusy] = useState(false);
  const [comparisonBusy, setComparisonBusy] = useState(false);
  const data = query.data;
  const australianRoute = data?.answers[options.identities.australia.subclass ?? ''];
  const australiaRouteReady =
    australianRoute?.status === 'known' &&
    australianRoute.question_version === data?.adapter_version &&
    typeof australianRoute.value === 'string' &&
    ['189', '190', '491'].includes(australianRoute.value);
  const save = useMutation({
    mutationFn: (body: unknown) => saveCalculatorAnswer(id, body),
    onSuccess: (next) => {
      cache.setQueryData(interviewQuery(id).queryKey, (old: Interview | undefined) => ({
        ...old,
        ...next,
      }));
      void cache.invalidateQueries({ queryKey: ['calculator-snapshots', id] });
      void cache.invalidateQueries({ queryKey: ['calculator-profile-evidence', id] });
      void cache.invalidateQueries({ queryKey: ['calculator-guidance', id] });
      void cache.invalidateQueries({ queryKey: ['calculator-comparison', id] });
      setDirty(false);
      setAutoPaused(false);
      setPending(null);
      setShown(null);
      setSnapshotRequest(null);
      setProfileCandidate(null);
      setGuidanceDecision(null);
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
        ...(guidanceDecision ? { guidance_sha256: guidanceDecision } : {}),
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
    guidanceDecision,
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
    hasNavigated.current = true;
    const answer = data.answers[options.identities[nextCountry][nextField] ?? ''];
    setCountry(nextCountry);
    setField(nextField);
    setStatus(answer?.status ?? 'unknown');
    setValue(answer?.value ?? undefined);
    setDirty(false);
    setPending(null);
    setShown(null);
    setSnapshotRequest(null);
    setProfileCandidate(null);
    setGuidanceDecision(null);
    setAutoPaused(false);
    save.reset();
  };
  const conflict = saveError instanceof ApiError && saveError.status === 409;
  return (
    <>
      <GuidedInterview
        id={id}
        country={country}
        revision={data.revision}
        disabled={dirty || saving || record.isPending || comparisonBusy}
        canReview={Boolean(options.can_review)}
        australiaRouteReady={australiaRouteReady}
        onRestore={(nextCountry) => {
          if (
            !hasNavigated.current &&
            !dirty &&
            !saving &&
            !record.isPending &&
            !pending &&
            !snapshotRequest &&
            !shown
          )
            choose(nextCountry, Object.keys(options.schemas[nextCountry])[0] ?? '');
        }}
        onBusy={setGuidanceBusy}
        onChanged={() => {
          setShown(null);
          setSnapshotRequest(null);
          setGuidanceDecision(null);
        }}
        onSelect={(nextCountry, question) => {
          choose(nextCountry, question.field);
          setGuidanceDecision(question.decision_sha256);
          const saved = data.answers[options.identities[nextCountry][question.field] ?? ''];
          if (question.reason === 'source_changed' && saved?.status === 'known') {
            setStatus('known');
            setValue(saved.value);
            setDirty(true);
            setAutoPaused(true);
          }
          focusEditor();
        }}
        onSkip={(nextCountry, question) => {
          choose(nextCountry, question.field);
          setStatus('unknown');
          setValue(undefined);
          setDirty(true);
          setAutoPaused(true);
          const body = {
            country: nextCountry,
            field: question.field,
            adapter_version: data.adapter_version,
            revision: data.revision,
            request_key: crypto.randomUUID(),
            status: 'unknown',
            value: null,
            guidance_sha256: question.decision_sha256,
          };
          setPending(body);
          saveAnswer(body);
        }}
      />
      <ProfileEvidence
        id={id}
        country={country}
        disabled={dirty || saving || record.isPending || guidanceBusy || comparisonBusy}
        onPrepare={(candidate) => {
          choose(country, candidate.field);
          setProfileCandidate(candidate);
          setStatus('known');
          setValue(candidate.value);
          setDirty(true);
          setAutoPaused(true);
          focusEditor();
        }}
      />
      <SectionCard id={sectionId} title={t('calculator.interview')} variant="panel">
        <fieldset
          ref={editorRef}
          tabIndex={-1}
          aria-label={t('calculator.interview')}
          disabled={saving || guidanceBusy || comparisonBusy}
          className="m-0 flex flex-col gap-4 border-0 p-0"
        >
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
              if (next !== 'known') setProfileCandidate(null);
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
          {profileCandidate && <Notice tone="warn">{t('calculator.profile.confirmation')}</Notice>}
          {profileCandidate && (
            <Button variant="outline" onClick={() => choose(country, field)}>
              {t('calculator.profile.discard')}
            </Button>
          )}
          {save.isPaused && <Notice tone="warn">{t('calculator.offline')}</Notice>}
          {saveError && (
            <Notice tone="error">
              {t(
                conflict
                  ? profileCandidate
                    ? 'calculator.profile.reloadConflict'
                    : 'calculator.conflict'
                  : 'calculator.failed',
              )}
            </Notice>
          )}
          <Button
            disabled={
              !dirty ||
              saving ||
              conflict ||
              (answerStatus === 'known' && !readyForAutosave(fields[field], answerValue))
            }
            onClick={() => {
              const body = pending ?? {
                country,
                field,
                adapter_version: data.adapter_version,
                revision: data.revision,
                request_key: crypto.randomUUID(),
                status: answerStatus,
                value: answerStatus === 'known' ? (answerValue ?? null) : null,
                ...(guidanceDecision ? { guidance_sha256: guidanceDecision } : {}),
                ...(profileCandidate && answerStatus === 'known'
                  ? {
                      profile_candidate: {
                        id: profileCandidate.id,
                        sha256: profileCandidate.sha256,
                      },
                    }
                  : {}),
              };
              setPending(body);
              saveAnswer(body);
            }}
          >
            {t(profileCandidate ? 'calculator.profile.confirmSave' : 'calculator.save')}
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
            disabled={
              dirty ||
              saving ||
              record.isPending ||
              (country === 'australia' && !australiaRouteReady)
            }
            onClick={() => record.mutate()}
          >
            {t('calculator.record')}
          </Button>
          {country === 'australia' && !australiaRouteReady && (
            <Notice tone="warn">{t('calculator.guided.routeRequired')}</Notice>
          )}
          {record.error && <Notice tone="error">{t('calculator.failed')}</Notice>}
        </fieldset>
      </SectionCard>
      <RouteComparison
        id={id}
        revision={data.revision}
        disabled={dirty || saving || record.isPending || guidanceBusy}
        onBusy={setComparisonBusy}
        onSelect={(nextCountry, nextField) => {
          choose(nextCountry, nextField);
          const existing = data.answers[options.identities[nextCountry][nextField] ?? ''];
          if (existing?.status === 'known') {
            setStatus('known');
            setValue(existing.value);
            setDirty(true);
            setAutoPaused(true);
          }
          focusEditor();
        }}
      />
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
