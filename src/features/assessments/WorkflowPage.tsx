import { sameAnswerContent } from './answerEquality';
import { useId, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { SelectField } from '@/components/ui/Choices';
import { Notice } from '@/components/ui/Notice';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { Pager } from '@/components/ui/Pager';
import { api, ApiError } from '@/lib/api/client';
import { toast } from '@/lib/toast';
import { useFormat } from '@/lib/i18n/useFormat';
import { CalculatorForm } from './CalculatorForm';
import { WorkflowResults } from './WorkflowResults';
import { WorkflowEvidence } from './WorkflowEvidence';
import {
  calculatorOptionsQuery,
  startCalculatorSession,
  readyForAutosave,
  sharedFactsQuery,
} from './calculatorApi';
import {
  saveWorkflow,
  workflowQuery,
  workflowHistoryQuery,
  workflowUrl,
  type Workflow,
  type WorkflowQuestion,
  type WorkflowScenario,
} from './workflowApi';

type EvidenceAction = 'preserve' | 'edit' | 'replace' | 'detach';
interface AnswerDraft {
  question: WorkflowQuestion;
  value: unknown;
  status: string;
  reference: string;
  evidenceAction: EvidenceAction;
  pending: Record<string, unknown> | null;
  dirty: boolean;
  reloaded: boolean;
}
const newDraft = (question: WorkflowQuestion): AnswerDraft => ({
  question,
  value: question.value ?? undefined,
  status: 'known',
  reference: question.current_reference ? 'current' : '',
  evidenceAction: 'preserve',
  pending: null,
  dirty: false,
  reloaded: false,
});

function QuestionEditor({
  id,
  data,
  question,
  onBusy,
  draft,
  onDraft,
}: {
  id: string;
  data: Workflow;
  question: WorkflowQuestion;
  onBusy: (busy: boolean) => void;
  draft: AnswerDraft | undefined;
  onDraft: (patch: Partial<AnswerDraft> | null) => void;
}) {
  const { t } = useTranslation('assessments');
  const cache = useQueryClient();
  const local = draft ?? newDraft(question);
  const { value, status, reference, evidenceAction, dirty, pending } = local;
  const setValue = (value: unknown) => onDraft({ value });
  const setStatus = (status: string) => onDraft({ status });
  const setReference = (reference: string) => onDraft({ reference });
  const setDirty = (dirty: boolean) => onDraft({ dirty });
  const setPending = (pending: Record<string, unknown> | null) => onDraft({ pending });
  const [scenario, setScenario] = useState<WorkflowScenario | null>(null);
  const facts = useQuery(sharedFactsQuery);
  const evidence = (facts.data?.evidence ?? []) as {
    id: string;
    revision: number;
    kind: string;
    value: unknown;
    confirmed_at: string | null;
  }[];
  const reusable = evidence.filter(
    (item) => item.kind === question.shared_kind && item.confirmed_at,
  );
  const labels = t('calculator.fields', { returnObjects: true }) as Record<string, string>;
  const evaluatorLabels = t('workflow.labels', { returnObjects: true }) as Record<string, string>;
  const mutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => saveWorkflow(id, body),
    onSuccess: async (next) => {
      cache.setQueryData(workflowQuery(id).queryKey, next);
      onDraft(null);
      onBusy(false);
      setScenario(null);
      await Promise.all([
        cache.invalidateQueries({ queryKey: workflowQuery(id).queryKey }),
        cache.invalidateQueries({ queryKey: sharedFactsQuery.queryKey }),
        cache.invalidateQueries({ queryKey: ['assessment-workflow-history', id] }),
      ]);
      toast.success(t('calculator.saved'));
    },
    onError: () => toast.error(t('calculator.failed')),
  });
  const preview = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api<WorkflowScenario>(`${workflowUrl(id)}scenario/`, { method: 'POST', body }),
    onSuccess: setScenario,
  });
  const normalizedValue = () => {
    if (status !== 'known') return null;
    if (question.shared_kind === 'language') {
      const report = value as Record<string, unknown> | undefined;
      return {
        test: null,
        date: null,
        scores: {},
        in_test_centre: null,
        one_skill_retake: null,
        ...report,
      };
    }
    return value ?? null;
  };
  const selectedReference =
    reference === 'current'
      ? question.current_reference
      : reusable.find((item) => item.id === reference);
  const body = () => ({
    question_id: question.id,
    decision_sha256: data.decision_sha256,
    status,
    value: normalizedValue(),
    evidence_action: evidenceAction,
    ...(selectedReference && evidenceAction !== 'replace' && evidenceAction !== 'detach'
      ? { shared_reference: { id: selectedReference.id, revision: selectedReference.revision } }
      : {}),
  });
  const conflict = mutation.error instanceof ApiError && mutation.error.status === 409;
  const sameCanonical = sameAnswerContent(
    { status: 'known', value },
    {
      status: 'known',
      value:
        reference === 'current'
          ? question.value
          : reusable.find((row) => row.id === reference)?.value,
    },
  );
  const sourceChoiceNeeded = Boolean(
    question.shared_kind &&
    selectedReference &&
    evidenceAction === 'preserve' &&
    status === 'known' &&
    !sameCanonical,
  );
  const unresolvedChoiceNeeded =
    question.can_detach && status !== 'known' && evidenceAction !== 'detach';
  const ready =
    !sourceChoiceNeeded &&
    !unresolvedChoiceNeeded &&
    (status !== 'known' || readyForAutosave(question.schema, value));
  const choices = t('calculator.choices', { returnObjects: true }) as Record<string, string>;
  const labelsForValues = t('calculator.fields', { returnObjects: true }) as Record<string, string>;
  const renderValue = (value: unknown): React.ReactNode => {
    if (value == null) return t('calculator.unknown');
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')
      return choices[String(value)] ?? String(value);
    if (typeof value !== 'object') return t('calculator.unknown');
    return (
      <dl>
        {Object.entries(value).map(([key, child]) => (
          <div key={key} className="flex flex-wrap gap-2">
            <dt>{labelsForValues[key] ?? t('workflow.evidence')}</dt>
            <dd>{renderValue(child)}</dd>
          </div>
        ))}
      </dl>
    );
  };
  const latest = data.review_questions.find((q) => q.id === question.id);
  const actions: EvidenceAction[] =
    question.shared_kind && (question.current_reference || selectedReference)
      ? ['preserve', 'edit', 'replace', ...(question.can_detach ? ['detach' as const] : [])]
      : question.can_detach
        ? ['preserve', 'detach']
        : ['preserve'];
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <h3 className="font-semibold">
        {question.label ?? labels[question.field.replaceAll('.', '_')] ?? t('workflow.question')}
      </h3>
      <p>
        {t('workflow.why', {
          evaluations: question.effects
            .map((key) => evaluatorLabels[key] ?? t('workflow.configured'))
            .join('، '),
        })}
      </p>
      {question.targets.length > 1 && <Notice tone="info">{t('workflow.shared')}</Notice>}
      <fieldset
        disabled={Boolean(pending) || mutation.isPending || preview.isPending}
        className="flex min-w-0 flex-col gap-4"
      >
        <SelectField
          label={t('calculator.answerStatus')}
          value={status}
          onChange={(next) => {
            setStatus(next);
            setDirty(true);
            setScenario(null);
            onBusy(true);
          }}
          options={question.allowed_statuses.map((key) => ({
            value: key,
            label: t(`calculator.choices.${key}`),
          }))}
        />
        {question.shared_kind && (
          <SelectField
            label={t('workflow.existingEvidence')}
            value={reference}
            options={[
              ...(question.current_reference
                ? [{ value: 'current', label: t('workflow.currentEvidence') }]
                : []),
              { value: '', label: t('workflow.newEvidence') },
              ...reusable.map((item, index) => ({
                value: item.id,
                label: t('workflow.evidenceNumber', { number: index + 1 }),
              })),
            ]}
            onChange={(next) => {
              setReference(next);
              onDraft({
                evidenceAction: next === '' && question.current_reference ? 'replace' : 'preserve',
              });
              const item = reusable.find((row) => row.id === next);
              if (item) setValue(item.value);
              setDirty(true);
              onBusy(true);
            }}
          />
        )}
        {actions.length > 1 && (
          <SelectField
            label={t('workflow.evidenceAction')}
            value={evidenceAction}
            options={actions.map((key) => ({
              value: key,
              label: t(`workflow.evidenceActions.${key}`),
            }))}
            onChange={(value) => {
              onDraft({ evidenceAction: value, dirty: true });
              onBusy(true);
            }}
          />
        )}
        {evidenceAction === 'edit' && (
          <Notice tone="warn">{t('workflow.editEvidenceMeaning')}</Notice>
        )}
        {(sourceChoiceNeeded || unresolvedChoiceNeeded) && (
          <Notice tone="warn">{t('workflow.chooseEvidenceIntent')}</Notice>
        )}
        {status === 'known' && (
          <CalculatorForm
            schema={question.schema}
            field={question.field}
            value={value}
            label={question.label ?? undefined}
            choiceLabels={
              question.label
                ? Object.fromEntries((question.schema.choices ?? []).map((key) => [key, key]))
                : undefined
            }
            onChange={(next) => {
              setValue(next);
              setDirty(true);
              setScenario(null);
              onBusy(true);
            }}
          />
        )}
      </fieldset>
      {dirty && !pending && (
        <Button
          variant="outline"
          onClick={() => {
            onDraft(null);
            setScenario(null);
            onBusy(false);
          }}
        >
          {t('workflow.discard')}
        </Button>
      )}
      {local.reloaded && (
        <Notice tone="warn">
          <p>{t('workflow.reviewConflict')}</p>
          <p>{t('workflow.serverAnswer')}</p>
          <div>{renderValue(latest?.value)}</div>
        </Notice>
      )}
      {mutation.error && (
        <Notice tone="error">{t(conflict ? 'workflow.conflict' : 'workflow.failed')}</Notice>
      )}
      <div className="flex flex-wrap gap-3">
        <Button
          disabled={!ready || mutation.isPending || preview.isPending || conflict || !data.writable}
          onClick={() => {
            const request = pending ?? {
              ...body(),
              action: 'answer',
              revision: data.revision,
              request_key: crypto.randomUUID(),
            };
            setPending(request);
            onBusy(true);
            mutation.mutate(request);
          }}
        >
          {t(pending ? 'workflow.retry' : 'calculator.save')}
        </Button>
        <Button
          variant="outline"
          disabled={!ready || Boolean(pending) || preview.isPending || !data.writable}
          onClick={() => preview.mutate(body())}
        >
          {t('workflow.preview')}
        </Button>
        {pending && !mutation.isPending && (
          <Button
            variant="outline"
            onClick={() => {
              void cache.invalidateQueries({ queryKey: workflowQuery(id).queryKey }).then(() => {
                onDraft({ pending: null, dirty: true, reloaded: true });
                mutation.reset();
                onBusy(true);
              });
            }}
          >
            {t('workflow.reload')}
          </Button>
        )}
      </div>
      {preview.error && <Notice tone="error">{t('workflow.failed')}</Notice>}
      {scenario && (
        <section aria-label={t('workflow.hypothetical')} className="flex flex-col gap-4">
          <Notice tone="warn">{t('workflow.hypothetical')}</Notice>
          <h3>{t('workflow.before')}</h3>
          <WorkflowResults results={scenario.baseline} prefix="scenario-before" />
          <h3>{t('workflow.after')}</h3>
          <WorkflowResults results={scenario.results} prefix="scenario-after" />
        </section>
      )}
    </div>
  );
}

function WorkflowHistoryPanel({ id }: { id: string }) {
  const { t } = useTranslation('assessments');
  const section = useId();
  const f = useFormat();
  const [page, setPage] = useState(1);
  const history = useQuery(workflowHistoryQuery(id, page));
  return (
    <SectionCard id={section + '-history'} title={t('workflow.history')} variant="panel">
      <p>{t('workflow.historyMeaning')}</p>
      {history.isPending && <SkeletonRows rows={2} />}
      {history.error && <Notice tone="error">{t('calculator.failed')}</Notice>}
      {history.data?.results.map((row) => (
        <details key={row.id}>
          <summary className="min-h-11 cursor-pointer py-3">
            <time dateTime={row.created_at}>{f.dateTime(row.created_at)}</time>
          </summary>
          <WorkflowResults results={row.payload.workflow.results} prefix={`history-${row.id}`} />
        </details>
      ))}
      {history.data && (
        <Pager
          page={page}
          pages={Math.max(1, Math.ceil(history.data.count / history.data.page_size))}
          onPage={setPage}
          pending={history.isFetching}
          inset
        />
      )}
    </SectionCard>
  );
}

function WorkflowSession({ id, onBusy }: { id: string; onBusy: (busy: boolean) => void }) {
  const { t, i18n } = useTranslation('assessments');
  const section = useId();
  const cache = useQueryClient();
  const query = useQuery(workflowQuery(id));
  const [paths, setPaths] = useState<string[] | null>(null);
  const [mode, setMode] = useState<'assessment' | 'explore' | null>(null);
  const [questionId, setQuestionId] = useState('');
  const [drafts, setDrafts] = useState<Record<string, AnswerDraft>>({});
  const [busy, setBusyState] = useState(false);
  const setBusy = (value: boolean) => {
    setBusyState(value);
    onBusy(value);
  };
  const [pending, setPending] = useState<Record<string, unknown> | null>(null);
  const mutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => saveWorkflow(id, body),
    onSuccess: async (next) => {
      cache.setQueryData(workflowQuery(id).queryKey, next);
      setPending(null);
      setPaths(null);
      setMode(null);
      await cache.invalidateQueries({ queryKey: ['assessment-workflow-history', id] });
      toast.success(t('calculator.saved'));
    },
    onError: () => toast.error(t('calculator.failed')),
  });
  const data = query.data;
  const labels = t('workflow.labels', { returnObjects: true }) as Record<string, string>;
  const locale = i18n.language === 'fa' ? 'fa' : 'en';
  const fields = t('calculator.fields', { returnObjects: true }) as Record<string, string>;
  if (!data)
    return (
      <>
        {query.isPending && <SkeletonRows rows={4} />}
        {query.error && <Notice tone="error">{t('workflow.currentUnavailable')}</Notice>}
        <WorkflowHistoryPanel id={id} />
      </>
    );
  // A pathway the adopted catalog no longer offers can't be selected again.
  const offered = new Set(data.options.map((option) => option.id));
  const selected = (paths ?? data.selected_pathways).filter((key) => offered.has(key));
  const send = (action: string) => {
    const request = pending ?? {
      action,
      revision: data.revision,
      request_key: crypto.randomUUID(),
      ...(action === 'select' ? { pathways: selected, mode: mode ?? data.mode } : {}),
    };
    setPending(request);
    mutation.mutate(request);
  };
  const disabled = busy || mutation.isPending || Boolean(pending);
  const questions = data.review_questions;
  const kept = Object.values(drafts).find((draft) => draft.dirty || draft.pending);
  const question =
    kept?.question ?? questions.find((q) => q.id === questionId) ?? data.next_question;
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <Notice tone="warn">
        {t('workflow.draft')} <bdi>{data.assessment_date}</bdi>
      </Notice>
      {!data.writable && <Notice tone="warn">{t('workflow.unavailable')}</Notice>}
      {data.unavailable_pathways.length > 0 && (
        <Notice tone="warn">{t('workflow.pathwayUnavailable')}</Notice>
      )}
      <SectionCard id={section + '-paths'} title={t('workflow.pathways')} variant="panel">
        <fieldset disabled={disabled || !data.writable} className="flex flex-col gap-2">
          {data.options
            .filter((option) => option.capabilities.includes('interview'))
            .map((option) => (
              <label key={option.id} className="flex min-h-11 items-center gap-3">
                <input
                  type="checkbox"
                  checked={selected.includes(option.id)}
                  onChange={(event) =>
                    setPaths(
                      event.target.checked
                        ? [...selected, option.id]
                        : selected.filter((key) => key !== option.id),
                    )
                  }
                />
                {option.title?.[locale] ?? labels[option.id] ?? t('workflow.configured')}
              </label>
            ))}
          <SelectField
            label={t('workflow.mode')}
            value={mode ?? data.mode}
            onChange={setMode}
            options={(['assessment', 'explore'] as const).map((key) => ({
              value: key,
              label: t(`workflow.modes.${key}`),
            }))}
          />
        </fieldset>
        <Button
          disabled={disabled || !selected.length || !data.writable}
          onClick={() => send('select')}
        >
          {t('workflow.begin')}
        </Button>
      </SectionCard>
      <SectionCard id={section + '-interview'} title={t('workflow.interview')} variant="panel">
        <p role="status">
          {t(`workflow.progress.${data.status}`, { defaultValue: t('workflow.review') })}
        </p>
        <SelectField
          label={t('workflow.reviewQuestion')}
          value={questionId}
          disabled={disabled}
          options={[
            { value: '', label: t('workflow.next') },
            ...questions.map((q) => ({
              value: q.id,
              label: q.scoped
                ? t('workflow.scopedQuestion', {
                    question:
                      q.label ?? fields[q.field.replaceAll('.', '_')] ?? t('workflow.question'),
                    evaluations: q.effects
                      .map((key) => labels[key] ?? t('workflow.configured'))
                      .join('، '),
                  })
                : (q.label ?? fields[q.field.replaceAll('.', '_')] ?? t('workflow.question')),
            })),
          ]}
          onChange={setQuestionId}
        />
        {question && (
          <QuestionEditor
            key={`${id}:${question.id}`}
            id={id}
            data={data}
            question={question}
            draft={drafts[question.id]}
            onDraft={(patch) =>
              setDrafts((old) => {
                const next = { ...old };
                if (patch === null)
                  return Object.fromEntries(
                    Object.entries(old).filter(([key]) => key !== question.id),
                  );
                else next[question.id] = { ...(old[question.id] ?? newDraft(question)), ...patch };
                return next;
              })
            }
            onBusy={setBusy}
          />
        )}
        {data.deferred.length > 0 && (
          <p>{t('workflow.deferred', { count: data.deferred.length })}</p>
        )}
        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            disabled={disabled || !data.writable || !data.selected_pathways.length}
            onClick={() => send(data.status === 'paused' ? 'resume' : 'pause')}
          >
            {t(data.status === 'paused' ? 'workflow.resume' : 'workflow.pause')}
          </Button>
          <Button
            disabled={disabled || !data.writable || !data.selected_pathways.length}
            onClick={() => send('record')}
          >
            {t('workflow.record')}
          </Button>
        </div>
        {mutation.error && (
          <Notice tone="error">
            {t(
              mutation.error instanceof ApiError && mutation.error.status === 409
                ? 'workflow.conflict'
                : 'workflow.failed',
            )}
          </Notice>
        )}
        {pending && !mutation.isPending && (
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => mutation.mutate(pending)}>{t('workflow.retry')}</Button>
            <Button
              variant="outline"
              onClick={() => {
                void query.refetch().then(() => {
                  setPending(null);
                  mutation.reset();
                });
              }}
            >
              {t('workflow.reload')}
            </Button>
          </div>
        )}
      </SectionCard>
      <WorkflowResults results={data.results} prefix="current" />
      <WorkflowEvidence
        id={id}
        disabled={disabled || !data.writable}
        onChanged={() => {
          void query.refetch();
        }}
      />
      <Link
        className="underline"
        to={`/dev/assessment-destinations?session=${encodeURIComponent(id)}`}
      >
        {t('workflow.destinations')}
      </Link>
      <WorkflowHistoryPanel id={id} />
    </div>
  );
}

export default function WorkflowPage() {
  const { t } = useTranslation('assessments');
  const section = useId();
  const [search, setSearch] = useSearchParams();
  const session = search.get('session') ?? '';
  const options = useQuery(calculatorOptionsQuery);
  const [ruleset, setRuleset] = useState('');
  const [childBusy, setChildBusy] = useState(false);
  const [requestKey, setRequestKey] = useState(() => crypto.randomUUID());
  const start = useMutation({
    mutationFn: () => startCalculatorSession(Number(ruleset), requestKey),
    onSuccess: (value) => {
      setSearch({ session: value.id });
      setRequestKey(crypto.randomUUID());
    },
  });
  return (
    <main className="mx-auto flex w-full max-w-5xl min-w-0 flex-col gap-6 p-4">
      <PageHeader title={t('workflow.title')} subtitle={t('workflow.subtitle')} />
      <SectionCard id={section} title={t('calculator.session')} variant="panel">
        {options.isPending && <SkeletonRows rows={2} />}
        {options.error && <Notice tone="error">{t('calculator.failed')}</Notice>}
        {options.data && (
          <>
            <SelectField
              label={t('calculator.resume')}
              value={session}
              disabled={childBusy}
              options={[
                { value: '', label: t('calculator.choose') },
                ...options.data.sessions.map((row) => ({ value: row.id, label: row.id })),
              ]}
              onChange={(id) => setSearch(id ? { session: id } : {})}
            />
            <SelectField
              label={t('calculator.ruleset')}
              value={ruleset}
              disabled={childBusy}
              options={[
                { value: '', label: t('calculator.choose') },
                ...options.data.rulesets.map((row) => ({
                  value: String(row.id),
                  label: `${row.key} · ${row.version}`,
                })),
              ]}
              onChange={setRuleset}
            />
            <Button
              disabled={!ruleset || start.isPending || childBusy}
              onClick={() => start.mutate()}
            >
              {t('calculator.start')}
            </Button>
            {start.error && <Notice tone="error">{t('calculator.failed')}</Notice>}
          </>
        )}
      </SectionCard>
      {/^[a-f0-9-]{36}$/i.test(session) && (
        <WorkflowSession key={session} id={session} onBusy={setChildBusy} />
      )}
    </main>
  );
}
