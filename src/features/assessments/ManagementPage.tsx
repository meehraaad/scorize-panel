import { FinancialPolicyEditor, FinancialScenarioEditor } from './FinancialPolicyEditor';
import { FinancialResult } from './FinancialResult';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { SelectField, TogglePill } from '@/components/ui/Choices';
import { Notice } from '@/components/ui/Notice';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pager } from '@/components/ui/Pager';
import { SectionCard } from '@/components/ui/SectionCard';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { TextAreaField, TextField } from '@/components/ui/TextField';
import { ApiError } from '@/lib/api/client';
import { useFormat } from '@/lib/i18n/useFormat';
import { toast } from '@/lib/toast';
import {
  draftAction,
  draftQuery,
  draftsQuery,
  optionsQuery,
  saveDraft,
  type Action,
  type Draft,
  type DraftInput,
  type Options,
} from './api';
import { RuleEditor, ValueField } from './RuleEditor';
import {
  blankExpected,
  conditionOf,
  nextId,
  questionReferenced,
  questionUsage,
  removeQuestion,
  removeRoute,
  valueOf,
} from './rules';
import { DefinitionTools } from './DefinitionTools';
import { ContentComparison, ContentHealth } from './ContentStatus';

const SOURCE_FIELDS = ['title', 'url', 'reviewed_on', 'review_due'] as const;
const REPORT_COLUMNS = ['route', 'expected', 'actual', 'before'] as const;

function serverMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return '';
  const strings = (value: unknown): string[] =>
    typeof value === 'string'
      ? [value]
      : value && typeof value === 'object'
        ? Object.values(value).flatMap(strings)
        : [];
  return strings(error.body).join(' ').slice(0, 1000);
}

export default function ManagementPage() {
  const { t } = useTranslation('assessments');
  const [page, setPage] = useState(1);
  const listQuery = useQuery(draftsQuery(page));
  const optionQuery = useQuery(optionsQuery);
  const list = listQuery.data;
  const options = optionQuery.data;
  const [selected, setSelected] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  // Detail is intentionally behind selecting a draft, not first-render data.
  const detail = useQuery({ ...draftQuery(selected ?? 0), enabled: selected !== null });
  if (!list || !options)
    return (
      <main className="mx-auto max-w-6xl p-4 sm:p-8">
        <PageHeader title={t('title')} />
        <SkeletonRows rows={4} />
        {(listQuery.error || optionQuery.error) && <Notice tone="error">{t('failed')}</Notice>}
      </main>
    );
  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-5 p-4 text-text sm:p-8">
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <Notice tone="warn">{t('sandbox')}</Notice>
      <ContentHealth
        onSelect={(id) => {
          setCreating(false);
          setSelected(id);
        }}
      />
      <SectionCard id="assessment-list" title={t('drafts')} variant="panel">
        {list.results.map((item) => (
          <Button
            key={item.id}
            variant="outline"
            onClick={() => {
              setCreating(false);
              setSelected(item.id);
            }}
          >
            {item.title}
          </Button>
        ))}
        <Pager
          page={page}
          pages={Math.max(1, Math.ceil(list.count / list.page_size))}
          onPage={setPage}
        />
        {options.permissions.create && (
          <Button
            onClick={() => {
              setSelected(null);
              setCreating(true);
            }}
          >
            {t('create')}
          </Button>
        )}
      </SectionCard>
      {detail.isFetching && selected !== null && !detail.data && <SkeletonRows rows={4} />}
      {detail.error && <Notice tone="error">{t('failed')}</Notice>}
      {(creating || (selected !== null && detail.data)) && (
        <DraftEditor
          key={creating ? 'new' : `${String(detail.data?.id)}:${String(detail.data?.revision)}`}
          draft={creating ? undefined : detail.data}
          options={options}
          onSaved={(id) => {
            setCreating(false);
            setSelected(id);
          }}
        />
      )}
    </main>
  );
}

function DraftEditor({
  draft,
  options,
  onSaved,
}: {
  draft: Draft | undefined;
  options: Options;
  onSaved: (id: number) => void;
}) {
  const { t } = useTranslation('assessments');
  const f = useFormat();
  const financialLabels = t('financial', { returnObjects: true });
  const routeLabels = t('comparison.labels', { returnObjects: true }) as Record<string, string>;
  const client = useQueryClient();
  const [input, setInput] = useState<DraftInput>(() =>
    structuredClone(
      draft ?? {
        key: '',
        title: '',
        bundle: options.bundle,
        scenarios: options.scenarios,
        sources: [],
      },
    ),
  );
  const [dirty, setDirty] = useState(!draft);
  const [failure, setFailure] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [publishAt, setPublishAt] = useState('');
  const update = (next: DraftInput) => {
    setInput(next);
    setDirty(true);
  };
  const requestRef = useRef<{ signature: string; key: string } | null>(null);
  const mutation = useMutation({
    mutationFn: (action: 'save' | Action) => {
      const signature = JSON.stringify({
        action,
        input,
        revision: draft?.revision,
        reviewNote,
        publishAt,
      });
      if (requestRef.current?.signature !== signature)
        requestRef.current = { signature, key: crypto.randomUUID() };
      const requestKey = requestRef.current.key;
      return action === 'save'
        ? saveDraft(input, draft, requestKey)
        : draft
          ? draftAction(
              draft,
              action,
              reviewNote,
              action === 'schedule' && publishAt ? new Date(publishAt).toISOString() : undefined,
              requestKey,
            )
          : Promise.reject(new Error());
    },
    onSuccess: (saved) => {
      requestRef.current = null;
      client.setQueryData(draftQuery(saved.id).queryKey, saved);
      void client.invalidateQueries({ queryKey: ['assessment-management', 'drafts'] });
      void client.invalidateQueries({ queryKey: ['assessment-management', 'health'] });
      onSaved(saved.id);
      toast.success(t('saved'));
    },
    onError: (error) => {
      setFailure(
        `${error instanceof ApiError && error.status === 409 ? t('conflict') : t('failed')} ${serverMessage(error)}`,
      );
    },
  });
  const locked =
    draft?.state === 'approved' || !(draft ? options.permissions.edit : options.permissions.create);
  const setQuestion = (index: number, value: DraftInput['bundle']['questions'][number]) =>
    update({
      ...input,
      scenarios:
        input.bundle.questions[index]?.kind !== value.kind
          ? input.scenarios.map((scenario) => ({
              ...scenario,
              answers: Object.fromEntries(
                Object.entries(scenario.answers).filter(([key]) => key !== value.id),
              ),
            }))
          : input.scenarios,
      bundle: {
        ...input.bundle,
        questions: input.bundle.questions.map((q, i) => (i === index ? value : q)),
      },
    });
  const setRoute = (index: number, value: DraftInput['bundle']['routes'][number]) =>
    update({
      ...input,
      bundle: {
        ...input.bundle,
        routes: input.bundle.routes.map((r, i) => (i === index ? value : r)),
      },
    });
  const permitted: Action[] = [
    ...(options.permissions.edit && draft?.state !== 'approved'
      ? (['test', 'submit'] as const)
      : []),
    ...(options.permissions.review && draft?.state === 'review'
      ? (['approve', 'reject'] as const)
      : []),
    ...(options.permissions.publish && draft?.state === 'approved' && !draft.is_active
      ? (['publish'] as const)
      : []),
    ...(options.permissions.publish && draft?.state === 'approved' && !draft.revoked
      ? (['revoke'] as const)
      : []),
    ...(options.permissions.publish &&
    draft?.state === 'approved' &&
    !draft.is_active &&
    !draft.revoked
      ? (['schedule'] as const)
      : []),
    ...(options.permissions.publish && draft?.scheduled_at ? (['cancel_schedule'] as const) : []),
  ];
  return (
    <>
      {failure && <Notice tone="error">{failure}</Notice>}
      <SectionCard
        id="assessment-edit"
        variant="panel"
        title={draft ? t(draft.state) : t('create')}
      >
        <fieldset
          disabled={locked || mutation.isPending}
          className="flex min-w-0 flex-col gap-5 border-0 p-0"
        >
          <TextField
            label={t('key')}
            value={input.key}
            disabled={!!draft}
            onChange={(e) => update({ ...input, key: e.target.value })}
          />
          <TextField
            label={t('draftTitle')}
            value={input.title}
            onChange={(e) => update({ ...input, title: e.target.value })}
          />
          {options.financial_policy && !input.bundle.financial_policy && (
            <Button
              variant="outline"
              onClick={() =>
                update({
                  ...input,
                  key: 'assessment-finance',
                  bundle: {
                    ...input.bundle,
                    financial_policy: structuredClone(
                      options.financial_policy ?? {
                        schema_version: 1,
                        ranges: [],
                        open_ended: 'ask_exact',
                        sufficient_bps: 10000,
                        tight_bps: 9999,
                        max_fx_age_days: 0,
                        round_to_toman: 1,
                        rates: [],
                        routes: [],
                      },
                    ),
                  },
                  scenarios: input.scenarios.map((s) => ({
                    ...s,
                    financial: [
                      {
                        route_id: 'ca-fsw',
                        inputs: {},
                        expected: { status: 'unknown', ask_exact: false },
                      },
                    ],
                  })),
                })
              }
            >
              {t('financial.addPolicy')}
            </Button>
          )}
          {input.bundle.financial_policy && (
            <FinancialPolicyEditor
              value={input.bundle.financial_policy}
              onChange={(financial_policy) =>
                update({ ...input, bundle: { ...input.bundle, financial_policy } })
              }
            />
          )}
          <DefinitionTools input={input} onChange={update} />
          <h2>{t('questions')}</h2>
          {input.bundle.questions.map((q, index) => (
            <details key={q.id} className="rounded-2xl border border-hair p-4">
              <summary className="min-h-11 cursor-pointer">{q.text}</summary>
              <div className="flex flex-col gap-3">
                <p>{t('stableIdentity', { id: q.id })}</p>
                <TextField
                  label={t('question')}
                  value={q.text}
                  onChange={(e) => setQuestion(index, { ...q, text: e.target.value })}
                />
                <TextField
                  label={t('questionHelp')}
                  value={q.help ?? ''}
                  onChange={(e) => setQuestion(index, { ...q, help: e.target.value })}
                />
                <TextField
                  label={t('questionEnglish')}
                  value={q.translations?.en ?? ''}
                  maxLength={512}
                  onChange={(e) =>
                    setQuestion(index, {
                      ...q,
                      translations: { ...q.translations, en: e.target.value },
                    })
                  }
                />
                <TextField
                  label={t('responseCost')}
                  type="number"
                  min={1}
                  max={100}
                  value={q.cost ?? 1}
                  onChange={(e) => setQuestion(index, { ...q, cost: Number(e.target.value) })}
                />
                <fieldset
                  disabled={questionReferenced(input.bundle, q.id)}
                  className="m-0 border-0 p-0"
                >
                  <SelectField
                    label={t('answerType')}
                    value={q.kind}
                    options={(['number', 'boolean', 'choice'] as const).map((value) => ({
                      value,
                      label: t(value),
                    }))}
                    onChange={(kind) => {
                      const next = { ...q, kind };
                      delete next.minimum;
                      delete next.maximum;
                      delete next.choices;
                      if (kind === 'number') {
                        next.minimum = 0;
                        next.maximum = 120;
                      }
                      if (kind === 'choice') next.choices = [t('newChoice')];
                      setQuestion(index, next);
                    }}
                  />
                </fieldset>
                <p className="text-sm text-text-2">{t('usageHelp')}</p>
                {questionUsage(input.bundle, q.id).map((usage, i) => (
                  <p key={i}>
                    {usage.route}
                    {t('separator')}
                    {usage.label}
                    {t('separator')}
                    {t(usage.reason)}
                  </p>
                ))}
                {!questionUsage(input.bundle, q.id).length && <p>{t('unusedQuestion')}</p>}
                {q.kind === 'number' && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <TextField
                      type="number"
                      label={t('minimum')}
                      value={q.minimum ?? ''}
                      onChange={(e) =>
                        setQuestion(index, { ...q, minimum: Number(e.target.value) })
                      }
                    />
                    <TextField
                      type="number"
                      label={t('maximum')}
                      value={q.maximum ?? ''}
                      onChange={(e) =>
                        setQuestion(index, { ...q, maximum: Number(e.target.value) })
                      }
                    />
                  </div>
                )}
                {q.choices?.map((choice, i) => (
                  <div key={i} className="flex items-end gap-2">
                    <TextField
                      label={t('choice')}
                      value={choice}
                      onChange={(e) =>
                        setQuestion(index, {
                          ...q,
                          choices: q.choices?.map((v, n) => (n === i ? e.target.value : v)) ?? [],
                        })
                      }
                    />
                    <Button
                      variant="outline"
                      disabled={(q.choices?.length ?? 0) <= 1}
                      onClick={() =>
                        setQuestion(index, {
                          ...q,
                          choices: q.choices?.filter((_, n) => n !== i) ?? [],
                        })
                      }
                    >
                      {t('removeChoice')}
                    </Button>
                  </div>
                ))}
                {q.kind === 'choice' && (
                  <Button
                    variant="outline"
                    onClick={() =>
                      setQuestion(index, {
                        ...q,
                        choices: [
                          ...(q.choices ?? []),
                          `${t('newChoice')} ${String((q.choices?.length ?? 0) + 1)}`,
                        ],
                      })
                    }
                  >
                    {t('addChoice')}
                  </Button>
                )}
                <TogglePill
                  label={t('conditionalQuestion')}
                  checked={!!q.show_if}
                  onChange={(checked) => {
                    const next = { ...q };
                    const parent = input.bundle.questions.find((v) => v.id !== q.id);
                    if (checked && parent) next.show_if = conditionOf(parent);
                    else delete next.show_if;
                    setQuestion(index, next);
                  }}
                />
                {q.show_if && (
                  <RuleEditor
                    questions={input.bundle.questions.filter((other) => other.id !== q.id)}
                    condition={q.show_if}
                    onChange={(show_if) => setQuestion(index, { ...q, show_if })}
                  />
                )}
                <Button
                  variant="outline"
                  disabled={
                    input.bundle.questions.length <= 1 || questionReferenced(input.bundle, q.id)
                  }
                  onClick={() => update(removeQuestion(input, q.id))}
                >
                  {t('removeQuestion')}
                </Button>
                {questionReferenced(input.bundle, q.id) && (
                  <p className="text-sm text-text-2">{t('removeReferencesFirst')}</p>
                )}
              </div>
            </details>
          ))}
          <h2>{t('routes')}</h2>
          {input.bundle.routes.map((r, index) => (
            <details key={r.id} className="rounded-2xl border border-hair p-4">
              <summary className="min-h-11 cursor-pointer">{r.name}</summary>
              <div className="flex flex-col gap-3">
                <p>{t('stableIdentity', { id: r.id })}</p>
                <TextField
                  label={t('name')}
                  value={r.name}
                  onChange={(e) => setRoute(index, { ...r, name: e.target.value })}
                />
                {r.requirements.map((req, n) => (
                  <div key={req.id}>
                    <TextField
                      label={t('requirement')}
                      value={req.label}
                      onChange={(e) =>
                        setRoute(index, {
                          ...r,
                          requirements: r.requirements.map((v, i) =>
                            i === n ? { ...v, label: e.target.value } : v,
                          ),
                        })
                      }
                    />
                    <RuleEditor
                      condition={req.condition}
                      questions={input.bundle.questions}
                      onChange={(condition) =>
                        setRoute(index, {
                          ...r,
                          requirements: r.requirements.map((v, i) =>
                            i === n ? { ...v, condition } : v,
                          ),
                        })
                      }
                    />
                    <Button
                      variant="outline"
                      disabled={r.requirements.length <= 1}
                      onClick={() =>
                        setRoute(index, {
                          ...r,
                          requirements: r.requirements.filter((_, i) => i !== n),
                        })
                      }
                    >
                      {t('removeRequirement')}
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  onClick={() => {
                    const first = input.bundle.questions[0];
                    if (first)
                      setRoute(index, {
                        ...r,
                        requirements: [
                          ...r.requirements,
                          {
                            id: nextId('requirement', r.requirements),
                            label: t('newRequirement'),
                            condition: conditionOf(first),
                          },
                        ],
                      });
                  }}
                >
                  {t('addRequirement')}
                </Button>
                {r.pass_mark !== undefined && (
                  <TextField
                    type="number"
                    label={t('passMark')}
                    value={r.pass_mark}
                    onChange={(e) => setRoute(index, { ...r, pass_mark: Number(e.target.value) })}
                  />
                )}
                {!!r.scores?.length && (
                  <TextField
                    type="number"
                    label={t('totalCap')}
                    value={r.score_cap ?? ''}
                    onChange={(e) => {
                      const next = { ...r };
                      if (e.target.value === '') delete next.score_cap;
                      else next.score_cap = Number(e.target.value);
                      setRoute(index, next);
                    }}
                  />
                )}
                {!!r.scores?.length && (
                  <TogglePill
                    label={t('usePassMark')}
                    checked={r.pass_mark !== undefined}
                    onChange={(checked) => {
                      const next = { ...r };
                      if (checked) next.pass_mark = 0;
                      else delete next.pass_mark;
                      setRoute(index, next);
                    }}
                  />
                )}
                {r.scores?.map((criterion, n) => (
                  <div key={criterion.id}>
                    <TextField
                      type="number"
                      label={t('criterionCap')}
                      value={criterion.cap ?? ''}
                      onChange={(e) =>
                        setRoute(index, {
                          ...r,
                          scores:
                            r.scores?.map((v, i) => {
                              if (i !== n) return v;
                              const next = { ...v };
                              if (e.target.value === '') delete next.cap;
                              else next.cap = Number(e.target.value);
                              return next;
                            }) ?? [],
                        })
                      }
                    />
                    <TextField
                      label={t('scoreLabel')}
                      value={criterion.label}
                      onChange={(e) =>
                        setRoute(index, {
                          ...r,
                          scores:
                            r.scores?.map((v, i) =>
                              i === n ? { ...v, label: e.target.value } : v,
                            ) ?? [],
                        })
                      }
                    />
                    {criterion.bands.map((band, k) => (
                      <div key={band.id}>
                        <TextField
                          type="number"
                          label={t('points')}
                          value={band.points}
                          onChange={(e) =>
                            setRoute(index, {
                              ...r,
                              scores:
                                r.scores?.map((v, i) =>
                                  i === n
                                    ? {
                                        ...v,
                                        bands: v.bands.map((b, j) =>
                                          j === k ? { ...b, points: Number(e.target.value) } : b,
                                        ),
                                      }
                                    : v,
                                ) ?? [],
                            })
                          }
                        />
                        <RuleEditor
                          condition={band.condition}
                          questions={input.bundle.questions}
                          onChange={(condition) =>
                            setRoute(index, {
                              ...r,
                              scores:
                                r.scores?.map((v, i) =>
                                  i === n
                                    ? {
                                        ...v,
                                        bands: v.bands.map((b, j) =>
                                          j === k ? { ...b, condition } : b,
                                        ),
                                      }
                                    : v,
                                ) ?? [],
                            })
                          }
                        />
                        <Button
                          variant="outline"
                          disabled={criterion.bands.length <= 1}
                          onClick={() =>
                            setRoute(index, {
                              ...r,
                              scores:
                                r.scores?.map((v, i) =>
                                  i === n ? { ...v, bands: v.bands.filter((_, j) => j !== k) } : v,
                                ) ?? [],
                            })
                          }
                        >
                          {t('removeBand')}
                        </Button>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      onClick={() => {
                        const first = input.bundle.questions[0];
                        if (first)
                          setRoute(index, {
                            ...r,
                            scores:
                              r.scores?.map((v, i) =>
                                i === n
                                  ? {
                                      ...v,
                                      bands: [
                                        ...v.bands,
                                        {
                                          id: nextId('band', v.bands),
                                          points: 0,
                                          condition: conditionOf(first),
                                        },
                                      ],
                                    }
                                  : v,
                              ) ?? [],
                          });
                      }}
                    >
                      {t('addBand')}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        const next = { ...r, scores: r.scores?.filter((_, i) => i !== n) ?? [] };
                        if (!next.scores.length) {
                          delete next.pass_mark;
                          delete next.score_cap;
                        }
                        setRoute(index, next);
                      }}
                    >
                      {t('removeScore')}
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  onClick={() => {
                    const first = input.bundle.questions[0];
                    if (first)
                      setRoute(index, {
                        ...r,
                        scores: [
                          ...(r.scores ?? []),
                          {
                            id: nextId('score', r.scores ?? []),
                            label: t('newScore'),
                            bands: [{ id: 'band-1', points: 0, condition: conditionOf(first) }],
                          },
                        ],
                      });
                  }}
                >
                  {t('addScore')}
                </Button>
                <Button
                  variant="outline"
                  disabled={input.bundle.routes.length <= 1}
                  onClick={() => update(removeRoute(input, r.id))}
                >
                  {t('removeRoute')}
                </Button>
              </div>
            </details>
          ))}
          <h2>{t('sources')}</h2>
          {input.sources.map((source, index) => (
            <div
              key={index}
              className="grid gap-3 rounded-2xl border border-hair p-4 sm:grid-cols-2"
            >
              {SOURCE_FIELDS.map((field) => (
                <TextField
                  key={field}
                  label={t(field === 'title' ? 'titleSource' : field)}
                  type={field === 'url' ? 'url' : field === 'title' ? 'text' : 'date'}
                  value={source[field]}
                  onChange={(e) =>
                    update({
                      ...input,
                      sources: input.sources.map((v, i) =>
                        i === index ? { ...v, [field]: e.target.value } : v,
                      ),
                    })
                  }
                />
              ))}
              <fieldset className="flex flex-wrap gap-2 border-0 p-0 sm:col-span-2">
                <legend>{t('sourceRoutes')}</legend>
                {input.bundle.routes.map((route) => (
                  <TogglePill
                    key={route.id}
                    label={route.name}
                    checked={source.route_ids.includes(route.id)}
                    onChange={(checked) =>
                      update({
                        ...input,
                        sources: input.sources.map((v, i) =>
                          i === index
                            ? {
                                ...v,
                                route_ids: checked
                                  ? [...v.route_ids, route.id]
                                  : v.route_ids.filter((id) => id !== route.id),
                              }
                            : v,
                        ),
                      })
                    }
                  />
                ))}
              </fieldset>
              <Button
                variant="outline"
                onClick={() =>
                  update({ ...input, sources: input.sources.filter((_, i) => i !== index) })
                }
              >
                {t('remove')}
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            onClick={() =>
              update({
                ...input,
                sources: [
                  ...input.sources,
                  {
                    title: '',
                    url: '',
                    reviewed_on: '',
                    review_due: '',
                    route_ids: [],
                  },
                ],
              })
            }
          >
            {t('addSource')}
          </Button>
          <h2>{t('scenarios')}</h2>
          {input.scenarios.map((scenario, index) => (
            <details key={index} className="rounded-2xl border border-hair p-4">
              <summary className="min-h-11 cursor-pointer">{scenario.name}</summary>
              <div className="flex flex-col gap-3">
                <TextField
                  label={t('name')}
                  value={scenario.name}
                  onChange={(e) =>
                    update({
                      ...input,
                      scenarios: input.scenarios.map((v, i) =>
                        i === index ? { ...v, name: e.target.value } : v,
                      ),
                    })
                  }
                />
                <TextField
                  label={t('assessmentDate')}
                  type="date"
                  value={scenario.assessment_date}
                  onChange={(e) =>
                    update({
                      ...input,
                      scenarios: input.scenarios.map((v, i) =>
                        i === index ? { ...v, assessment_date: e.target.value } : v,
                      ),
                    })
                  }
                />
                {input.bundle.questions.map((q) => {
                  const fact = scenario.answers[q.id];
                  const set = (
                    status: 'known' | 'unknown',
                    value: string | number | boolean | null,
                  ) =>
                    update({
                      ...input,
                      scenarios: input.scenarios.map((v, i) =>
                        i === index
                          ? { ...v, answers: { ...v.answers, [q.id]: { status, value } } }
                          : v,
                      ),
                    });
                  return (
                    <div key={q.id}>
                      <SelectField
                        label={q.text}
                        value={fact?.status === 'known' ? 'known' : 'unknown'}
                        options={[
                          { value: 'unknown', label: t('unknown') },
                          { value: 'known', label: t('known') },
                        ]}
                        onChange={(status) => set(status, status === 'known' ? valueOf(q) : null)}
                      />
                      {fact?.status === 'known' && (
                        <ValueField
                          question={q}
                          value={fact.value ?? valueOf(q)}
                          onChange={(value) => set('known', value)}
                        />
                      )}
                    </div>
                  );
                })}
                {input.bundle.financial_policy && (
                  <FinancialScenarioEditor
                    policy={input.bundle.financial_policy}
                    cases={scenario.financial ?? []}
                    onChange={(financial) =>
                      update({
                        ...input,
                        scenarios: input.scenarios.map((s, i) =>
                          i === index ? { ...s, financial } : s,
                        ),
                      })
                    }
                  />
                )}
                <p>{t('independent')}</p>
                {scenario.expected.map((expected, n) => {
                  const setExpected = (value: Partial<typeof expected>) =>
                    update({
                      ...input,
                      scenarios: input.scenarios.map((v, i) =>
                        i === index
                          ? {
                              ...v,
                              expected: v.expected.map((r, j) =>
                                j === n ? { ...r, ...value } : r,
                              ),
                            }
                          : v,
                      ),
                    });
                  return (
                    <div
                      key={expected.route_id}
                      className="grid gap-3 border-t border-hair pt-3 sm:grid-cols-2"
                    >
                      <b>{input.bundle.routes.find((r) => r.id === expected.route_id)?.name}</b>
                      <SelectField
                        label={t('eligibility')}
                        value={expected.eligibility_status}
                        onChange={(eligibility_status) => setExpected({ eligibility_status })}
                        options={(['met', 'unmet', 'insufficient_information'] as const).map(
                          (value) => ({ value, label: t(value) }),
                        )}
                      />
                      <SelectField
                        label={t('scoreStatus')}
                        value={expected.score_status}
                        onChange={(score_status) =>
                          setExpected({
                            score_status,
                            ...(score_status !== 'complete_self_reported'
                              ? { score: null, pass_mark_met: null }
                              : {}),
                          })
                        }
                        options={(
                          ['partial', 'complete_self_reported', 'not_applicable'] as const
                        ).map((value) => ({ value, label: t(value) }))}
                      />
                      <TextField
                        label={t('expectedScore')}
                        type="number"
                        value={expected.score ?? ''}
                        onChange={(e) =>
                          setExpected({
                            score: e.target.value === '' ? null : Number(e.target.value),
                          })
                        }
                      />
                      <SelectField
                        label={t('passMark')}
                        value={
                          expected.pass_mark_met === null
                            ? 'unknown'
                            : expected.pass_mark_met
                              ? 'yes'
                              : 'no'
                        }
                        options={(['unknown', 'yes', 'no'] as const).map((value) => ({
                          value,
                          label: t(value),
                        }))}
                        onChange={(value) =>
                          setExpected({
                            pass_mark_met: value === 'unknown' ? null : value === 'yes',
                          })
                        }
                      />
                    </div>
                  );
                })}
                <Button
                  variant="outline"
                  disabled={input.scenarios.length <= 1}
                  onClick={() =>
                    update({ ...input, scenarios: input.scenarios.filter((_, i) => i !== index) })
                  }
                >
                  {t('removeScenario')}
                </Button>
              </div>
            </details>
          ))}
          <Button
            variant="outline"
            onClick={() =>
              update({
                ...input,
                scenarios: [
                  ...input.scenarios,
                  {
                    name: `${t('newScenario')} ${String(input.scenarios.length + 1)}`,
                    assessment_date: input.scenarios[0]?.assessment_date ?? '',
                    answers: {},
                    expected: input.bundle.routes.map((r) =>
                      blankExpected(r.id, !!r.scores?.length),
                    ),
                  },
                ],
              })
            }
          >
            {t('addScenario')}
          </Button>
          {!locked && (
            <Button
              disabled={mutation.isPending || !input.key || !input.title}
              onClick={() => mutation.mutate('save')}
            >
              {t('save')}
            </Button>
          )}
        </fieldset>
        {dirty && <Notice tone="info">{t('unsaved')}</Notice>}
        {draft?.scheduled_at && (
          <Notice tone="info">{t('scheduledFor', { time: f.dateTime(draft.scheduled_at) })}</Notice>
        )}
        {draft?.state === 'approved' && !draft.is_active && options.permissions.publish && (
          <TextField
            type="datetime-local"
            label={t('publishAt')}
            hint={t('deviceTimezone')}
            value={publishAt}
            onChange={(e) => setPublishAt(e.target.value)}
          />
        )}
        {draft?.state === 'review' && options.permissions.review && (
          <TextAreaField
            label={t('reviewNote')}
            value={reviewNote}
            maxLength={2000}
            onChange={(e) => setReviewNote(e.target.value)}
          />
        )}
        <div className="flex flex-wrap gap-3">
          {permitted.map((action) => (
            <Button
              key={action}
              variant="outline"
              disabled={
                dirty ||
                mutation.isPending ||
                (action === 'reject' && !reviewNote.trim()) ||
                (action === 'schedule' &&
                  (!publishAt || !Number.isFinite(new Date(publishAt).getTime())))
              }
              onClick={() => mutation.mutate(action)}
            >
              {t(action)}
            </Button>
          ))}
          {draft && options.permissions.create && (
            <Button
              variant="outline"
              onClick={() => {
                setInput({ ...structuredClone(draft), key: draft.key, title: draft.title });
                void saveDraft({ ...structuredClone(draft), key: draft.key, title: draft.title })
                  .then((saved) => {
                    client.setQueryData(draftQuery(saved.id).queryKey, saved);
                    void client.invalidateQueries({
                      queryKey: ['assessment-management', 'drafts'],
                    });
                    onSaved(saved.id);
                  })
                  .catch(() => toast.error(t('failed')));
              }}
            >
              {t('clone')}
            </Button>
          )}
        </div>
      </SectionCard>
      {draft?.last_run && (
        <SectionCard id="assessment-report" variant="panel" title={t('report')}>
          <Notice tone={draft.last_run.passed ? 'success' : 'error'}>
            {t(draft.last_run.passed ? 'passed' : 'testFailed')}
          </Notice>
          {draft.last_run.report.map((row) => (
            <div key={row.name} className="overflow-x-auto">
              <h3>{row.name}</h3>
              {row.financial?.map((test, i) => (
                <div key={i} className="border-line my-3 rounded-xl border p-3">
                  <p>{routeLabels[test.route_id]}</p>
                  <p>
                    {t('expected')}: {financialLabels[test.expected.status]}
                  </p>
                  <p>
                    {t('before')}: {t(`financial.${test.before.status}`)}
                  </p>
                  <FinancialResult result={test.actual} />
                </div>
              ))}
              {!!row.before_incompatible_answers?.length && (
                <Notice tone="warn">
                  {t('incompatibleBaseline', {
                    questions: row.before_incompatible_answers.join(t('separator')),
                  })}
                </Notice>
              )}
              <table className="w-full min-w-[640px] text-start">
                <thead>
                  <tr>
                    {REPORT_COLUMNS.map((key) => (
                      <th key={key} className="p-3 text-start">
                        {t(key)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {row.actual.results.map((result) => {
                    const before = row.before?.results.find((r) => r.route_id === result.route_id);
                    const expected = row.expected.find((r) => r.route_id === result.route_id);
                    return (
                      <tr key={result.route_id}>
                        <td className="p-3">{result.name}</td>
                        <td className="p-3">
                          {expected
                            ? `${t(expected.eligibility_status)} / ${expected.score === null ? t('unknown') : f.number(expected.score)}`
                            : t('unknown')}
                        </td>
                        <td className="p-3">
                          {t(result.eligibility_status)} /{' '}
                          {result.score === null ? t('unknown') : f.number(result.score)}
                          {result.requirement_details.map((req) => (
                            <p key={req.id}>
                              {req.label}: {t(req.status)}
                            </p>
                          ))}
                        </td>
                        <td className="p-3">
                          {before
                            ? `${t(before.eligibility_status)} / ${before.score === null ? t('unknown') : f.number(before.score)}`
                            : t('unknown')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </SectionCard>
      )}
      {draft && <ContentComparison comparison={draft.comparison} />}
      {draft && (
        <SectionCard id="assessment-audit" title={t('history')} variant="panel">
          {draft.events.map((event) => (
            <p key={event.id}>
              {t('audit', {
                action: t(event.action as Action),
                actor: f.number(event.actor_id),
                revision: f.number(event.revision),
              })}
              {event.detail?.note && (
                <span className="block whitespace-pre-wrap">{event.detail.note}</span>
              )}
            </p>
          ))}
        </SectionCard>
      )}
    </>
  );
}
