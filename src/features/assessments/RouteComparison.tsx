import { FinancialResult } from './FinancialResult';
import { useEffect, useId, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { SectionCard } from '@/components/ui/SectionCard';
import { SelectField, TogglePill } from '@/components/ui/Choices';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { safeHref } from '@/lib/url';
import { ApiError } from '@/lib/api/client';
import { toast } from '@/lib/toast';
import {
  comparisonQuery,
  interviewQuery,
  updateComparison,
  recordComparison,
  type Country,
  type Interview,
  type ComparisonSnapshot,
} from './calculatorApi';

const ROUTES = ['ca-fsw', 'ca-cec', 'ca-fst', 'au-189', 'au-190', 'au-491'];

function ComparisonCards({ data }: { data: ComparisonSnapshot['payload'] }) {
  const { t } = useTranslation('assessments');
  const words = t('comparison.labels', { returnObjects: true }) as Record<string, string>;
  const fields = t('calculator.fields', { returnObjects: true }) as Record<string, string>;
  const label = (key: string) =>
    words[key] ?? fields[key.replaceAll('.', '_')] ?? t('calculator.unknown');
  return (
    <>
      <Notice tone="warn">{t('comparison.scope')}</Notice>
      <p>
        {t('comparison.basis', {
          date: data.context.assessment_date,
          version: data.version,
          revision: data.context.session_revision,
        })}
      </p>
      {data.financial_context && (
        <p>
          {t('financial.basisDate', {
            date: data.context.assessment_date,
            version: data.financial_context.policy?.version ?? t('financial.unknown'),
          })}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {data.routes.map((route) => (
          <article key={route.route_id} className="border-line min-w-0 rounded-2xl border p-4">
            <h3 className="font-bold">{label(route.route_id)}</h3>
            <p>
              {t('comparison.condition')}: {label(route.eligibility_status)}
            </p>
            <p>
              {t('comparison.score')}:{' '}
              {route.score
                ? `${label(route.score.system)}: ${route.score.score ?? t('calculator.partial')}`
                : route.eligibility_status === 'not_evaluated'
                  ? t('transfer.scoreUnavailable')
                  : t('calculator.partial')}
            </p>
            {route.selection_score && (
              <p>
                {label(route.selection_score.system)}:{' '}
                {route.selection_score.score ?? t('calculator.partial')}
              </p>
            )}
            {route.score && (
              <details>
                <summary className="min-h-11 cursor-pointer py-2">
                  {t('comparison.breakdown')}
                </summary>
                <ul className="list-inside list-disc">
                  {Object.entries(route.score.breakdown).map(([key, value]) => (
                    <li key={key}>
                      {label(key)}: {value ?? t('calculator.unknown')}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            <ul className="list-inside list-disc">
              {Object.entries(route.requirements).map(([key, value]) => (
                <li key={key}>
                  {label(key)}: {label(value)}
                </li>
              ))}
            </ul>
            {route.conditional_points.map((scenario) => (
              <Notice key={scenario.kind} tone="warn">
                <p>{label(scenario.kind)}</p>
                <p>
                  {t('comparison.hypothetical', {
                    score: scenario.score ?? t('calculator.partial'),
                  })}
                </p>
              </Notice>
            ))}
            {route.financial && <FinancialResult result={route.financial} />}
            <p className="mt-3 text-sm text-text-2">{t('comparison.unavailable')}</p>
            <details>
              <summary className="min-h-11 cursor-pointer py-2">
                {t('comparison.limitations')}
              </summary>
              <ul className="list-inside list-disc">
                {route.limitations.map((key) => (
                  <li key={key}>{label(key)}</li>
                ))}
              </ul>
            </details>
          </article>
        ))}
      </div>
      <details>
        <summary className="min-h-11 cursor-pointer py-2">{t('comparison.sources')}</summary>
        {Object.entries(data.sources).map(([country, bundle]) => (
          <div key={country} className="min-w-0 break-words">
            <p>{label(country)}</p>
            <p className="text-xs">{bundle.sha256}</p>
            <ul>
              {Object.entries(bundle.manifest.sources).map(([key, source]) => (
                <li key={key}>
                  <a href={safeHref(source.url)} className="underline">
                    {key}
                  </a>{' '}
                  {source.checked_on}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </details>
    </>
  );
}

export function ComparisonResult({ snapshot }: { snapshot: ComparisonSnapshot }) {
  const { t } = useTranslation('assessments');
  const id = useId();
  const words = t('comparison.labels', { returnObjects: true }) as Record<string, string>;
  const fields = t('calculator.fields', { returnObjects: true }) as Record<string, string>;
  return (
    <SectionCard id={id} title={t('comparison.saved')} variant="panel">
      {snapshot.stale_reasons.length > 0 && <Notice tone="warn">{t('calculator.stale')}</Notice>}
      <ComparisonCards data={snapshot.payload} />
      <p>{t('comparison.progressMeaning')}</p>
      <ul className="list-inside list-disc">
        {snapshot.payload.actions.map((task) => (
          <li key={task.id}>
            {words[task.kind]} —{' '}
            {task.field ? fields[task.field.replaceAll('.', '_')] : words[task.requirement ?? '']} —{' '}
            {task.applies_to.map((route) => words[route]).join(t('comparison.listSeparator'))} —{' '}
            {words[task.status]}
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

export function RouteComparison(props: {
  id: string;
  revision: number;
  disabled: boolean;
  onBusy: (busy: boolean) => void;
  onSelect: (country: Country, field: string) => void;
  onFinancialSelect: () => void;
}) {
  const { t } = useTranslation('assessments');
  const sectionId = useId();
  const [open, setOpen] = useState(false);
  return (
    <SectionCard id={sectionId} title={t('comparison.title')} variant="panel">
      {!open ? (
        <Button variant="outline" onClick={() => setOpen(true)}>
          {t('comparison.open')}
        </Button>
      ) : (
        <ComparisonEditor {...props} />
      )}
    </SectionCard>
  );
}

function ComparisonEditor({
  id,
  revision,
  disabled,
  onBusy,
  onSelect,
  onFinancialSelect,
}: {
  id: string;
  revision: number;
  disabled: boolean;
  onBusy: (busy: boolean) => void;
  onSelect: (country: Country, field: string) => void;
  onFinancialSelect: () => void;
}) {
  const { t } = useTranslation('assessments');
  const words = t('comparison.labels', { returnObjects: true }) as Record<string, string>;
  const fields = t('calculator.fields', { returnObjects: true }) as Record<string, string>;
  const cache = useQueryClient();
  const query = useQuery(comparisonQuery(id));
  const [routes, setRoutes] = useState<string[] | null>(null);
  const [pending, setPending] = useState<{ kind: 'update' | 'record'; body: unknown } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const mutation = useMutation({
    mutationFn: async (request: { kind: 'update' | 'record'; body: unknown }) => {
      if (request.kind === 'record') {
        await recordComparison(id, request.body);
        void cache.invalidateQueries({ queryKey: ['calculator-snapshots', id] });
      } else {
        const next = await updateComparison(id, request.body);
        cache.setQueryData(comparisonQuery(id).queryKey, next.comparison);
        cache.setQueryData(interviewQuery(id).queryKey, (old: Interview | undefined) =>
          old ? { ...old, revision: next.revision, answers: next.answers } : old,
        );
        void cache.invalidateQueries({ queryKey: ['calculator-guidance', id] });
        void cache.invalidateQueries({ queryKey: ['calculator-snapshots', id] });
      }
    },
    onSuccess: () => {
      setPending(null);
      setRoutes(null);
      toast.success(t('comparison.savedToast'));
    },
  });
  useEffect(() => {
    onBusy(mutation.isPending || refreshing);
    return () => onBusy(false);
  }, [mutation.isPending, refreshing, onBusy]);
  const data = query.data;
  const conflict = mutation.error instanceof ApiError && mutation.error.status === 409;
  const locked =
    disabled ||
    Boolean(query.error) ||
    conflict ||
    mutation.isPending ||
    refreshing ||
    query.isFetching ||
    !data?.writable ||
    Boolean(pending) ||
    data.context.session_revision !== revision;
  const send = (action: string, extra: Record<string, unknown> = {}) => {
    if (!data) return;
    const request = {
      kind: action === 'record' ? ('record' as const) : ('update' as const),
      body: {
        revision: data.context.session_revision,
        decision_sha256: data.decision_sha256,
        request_key: crypto.randomUUID(),
        ...(action === 'record' ? {} : { action }),
        ...extra,
      },
    };
    setPending(request);
    mutation.mutate(request);
  };
  const refresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        query.refetch(),
        cache.refetchQueries({ queryKey: interviewQuery(id).queryKey, exact: true }),
      ]);
      setPending(null);
      mutation.reset();
    } finally {
      setRefreshing(false);
    }
  };
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <Button
        variant="outline"
        disabled={disabled || mutation.isPending || refreshing || Boolean(pending)}
        onClick={() => void refresh()}
      >
        {t('comparison.refresh')}
      </Button>
      {query.isPending && <SkeletonRows rows={4} />}
      {query.error && <Notice tone="error">{t('comparison.failed')}</Notice>}
      {mutation.error && (
        <Notice tone="error">{t(conflict ? 'comparison.conflict' : 'comparison.failed')}</Notice>
      )}
      {mutation.isPaused && <Notice tone="warn">{t('calculator.offline')}</Notice>}
      {pending && !mutation.isPending && !conflict && (
        <Button disabled={disabled} onClick={() => mutation.mutate(pending)}>
          {t('comparison.retry')}
        </Button>
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
          {data.context.session_revision !== revision && (
            <Notice tone="warn">{t('comparison.conflict')}</Notice>
          )}
          <p>{t('comparison.orderMeaning')}</p>
          <div className="flex flex-wrap gap-2">
            {ROUTES.map((route) => (
              <TogglePill
                key={route}
                label={words[route] ?? route}
                checked={(routes ?? data.selected_routes).includes(route)}
                disabled={locked}
                onChange={(checked) =>
                  setRoutes(
                    checked
                      ? [...(routes ?? data.selected_routes), route]
                      : (routes ?? data.selected_routes).filter((r) => r !== route),
                  )
                }
              />
            ))}
          </div>
          <Button
            disabled={locked || !routes?.length}
            onClick={() => send('select_routes', { routes })}
          >
            {t('comparison.saveRoutes')}
          </Button>
          <ComparisonCards data={data} />
          <h3 className="font-bold">{t('comparison.actions')}</h3>
          <Notice tone="warn">{t('comparison.progressMeaning')}</Notice>
          <ol className="flex list-inside list-decimal flex-col gap-4">
            {data.actions.map((task) => (
              <li key={task.id} className="border-line min-w-0 rounded-2xl border p-3">
                <span className="font-semibold">{words[task.kind] ?? t('calculator.unknown')}</span>
                <p>
                  {task.applies_to.map((route) => words[route]).join(t('comparison.listSeparator'))}
                </p>
                {task.field && (
                  <p>{fields[task.field.replaceAll('.', '_')] ?? t('calculator.unknown')}</p>
                )}
                {task.requirement && <p>{words[task.requirement] ?? t('calculator.unknown')}</p>}
                {task.depends_on.length > 0 && (
                  <p>
                    {t('comparison.depends', {
                      actions: task.depends_on
                        .map((key) => data.actions.findIndex((a) => a.id === key) + 1)
                        .join(t('comparison.listSeparator')),
                    })}
                  </p>
                )}
                {task.answer_status && (
                  <p>
                    {t('comparison.answer')}: {words[task.answer_status] ?? t('calculator.unknown')}
                  </p>
                )}
                {task.requires_reassessment && <p>{t('comparison.recheck')}</p>}
                <SelectField
                  label={t('comparison.progress', {
                    action: words[task.kind],
                    routes: task.applies_to
                      .map((route) => words[route])
                      .join(t('comparison.listSeparator')),
                    field: task.field
                      ? fields[task.field.replaceAll('.', '_')]
                      : (words[task.requirement ?? ''] ?? ''),
                  })}
                  value={task.status}
                  options={(['todo', 'in_progress', 'done'] as const).map((value) => ({
                    value,
                    label: words[value] ?? value,
                  }))}
                  disabled={locked || Boolean(routes)}
                  onChange={(status) => send('progress', { task_id: task.id, status })}
                />
                {task.financial && (
                  <Button
                    variant="outline"
                    disabled={locked || Boolean(routes)}
                    onClick={onFinancialSelect}
                  >
                    {t('financial.open')}
                  </Button>
                )}
                {task.field && (
                  <Button
                    variant="outline"
                    disabled={locked || Boolean(routes)}
                    onClick={() => onSelect(task.country, task.field ?? '')}
                  >
                    {t('comparison.openQuestion')}
                  </Button>
                )}
              </li>
            ))}
          </ol>
          <Button disabled={locked || Boolean(routes)} onClick={() => send('record')}>
            {t('comparison.record')}
          </Button>
        </>
      )}
    </div>
  );
}
