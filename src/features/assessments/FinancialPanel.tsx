import { sameAnswerContent } from './answerEquality';
import { useEffect, useId, useState } from 'react';
import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { SelectField } from '@/components/ui/Choices';
import { Notice } from '@/components/ui/Notice';
import { SectionCard } from '@/components/ui/SectionCard';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { api, ApiError } from '@/lib/api/client';
import { toast } from '@/lib/toast';
import { FinancialInputs } from './FinancialInputs';
import { FinancialResult } from './FinancialResult';
import { interviewQuery, type Interview } from './calculatorApi';
import {
  FINANCIAL_ROUTES,
  type FinancialDescription,
  type FinancialInputs as Inputs,
  type FinancialResult as Result,
} from './financialTypes';

function errorText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') return Object.values(value).map(errorText).join(' ');
  return '';
}
const financialQuery = (id: string) =>
  queryOptions({
    queryKey: ['calculator-financial', id],
    queryFn: ({ signal }) =>
      api<FinancialDescription>(`/applicant/v1/assessments/${id}/calculators/financial/`, {
        signal,
      }),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
const FIELDS = ['budget', 'resources', 'dependants', 'proof_family_size'] as const;
export function FinancialPanel(props: {
  id: string;
  revision: number;
  disabled: boolean;
  onBusy: (busy: boolean) => void;
  open: boolean;
  onOpen: () => void;
}) {
  const { t } = useTranslation('assessments');
  const section = useId();
  return (
    <SectionCard id={section} title={t('financial.title')} variant="panel">
      {props.open ? (
        <Editor {...props} />
      ) : (
        <Button variant="outline" onClick={props.onOpen}>
          {t('financial.open')}
        </Button>
      )}
    </SectionCard>
  );
}
function Editor({
  id,
  revision,
  disabled,
  onBusy,
}: {
  id: string;
  revision: number;
  disabled: boolean;
  onBusy: (busy: boolean) => void;
}) {
  const { t } = useTranslation('assessments');
  const routeLabels = t('comparison.labels', { returnObjects: true }) as Record<string, string>;
  const cache = useQueryClient();
  const query = useQuery(financialQuery(id));
  const data = query.data;
  const [input, setInput] = useState<Inputs | null>(null);
  const [pending, setPending] = useState<Record<string, unknown> | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [route, setRoute] = useState('ca-fsw');
  const [scenario, setScenario] = useState<{ before: Result; after: Result } | null>(null);
  const mutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api<{ revision: number; answers: Interview['answers']; financial: FinancialDescription }>(
        `/applicant/v1/assessments/${id}/calculators/financial/`,
        { method: 'POST', body },
      ),
    onSuccess: (next) => {
      cache.setQueryData(financialQuery(id).queryKey, next.financial);
      cache.setQueryData(interviewQuery(id).queryKey, (old: Interview | undefined) =>
        old ? { ...old, revision: next.revision, answers: next.answers } : old,
      );
      void cache.invalidateQueries({ queryKey: ['calculator-comparison', id] });
      void cache.invalidateQueries({ queryKey: ['assessment-destinations', id] });
      void cache.invalidateQueries({ queryKey: ['calculator-guidance', id] });
      void cache.invalidateQueries({ queryKey: ['calculator-snapshots', id] });
      // Saving one fact preserves all other unsaved fields.
      const field = pending?.field as keyof Inputs | undefined;
      if (field)
        setInput((old) => (old ? { ...old, [field]: next.financial.inputs[field] } : null));
      setPending(null);
      toast.success(t('financial.saved'));
    },
  });
  const preview = useMutation({
    mutationFn: () =>
      api<{ before: Result; after: Result }>(
        `/applicant/v1/assessments/${id}/calculators/financial/scenario/`,
        {
          method: 'POST',
          body: {
            decision_sha256: data?.decision_sha256,
            route_id: route,
            inputs: input ?? data?.inputs,
          },
        },
      ),
    onSuccess: setScenario,
  });
  const dirty = Boolean(
    input && data && FIELDS.some((field) => !sameAnswerContent(input[field], data.inputs[field])),
  );
  useEffect(() => {
    onBusy(dirty || Boolean(pending) || mutation.isPending || preview.isPending || refreshing);
    return () => onBusy(false);
  }, [dirty, pending, mutation.isPending, preview.isPending, refreshing, onBusy]);
  const conflict = mutation.error instanceof ApiError && mutation.error.status === 409;
  const locked =
    disabled ||
    Boolean(query.error) ||
    conflict ||
    Boolean(pending) ||
    mutation.isPending ||
    preview.isPending ||
    query.isFetching ||
    refreshing ||
    !data?.writable ||
    revision !== data.revision;
  const send = (action: string, field?: keyof Inputs) => {
    if (!data) return;
    const fact = field ? (input ?? data.inputs)[field] : undefined;
    const body = {
      action,
      revision: data.revision,
      decision_sha256: data.decision_sha256,
      request_key: crypto.randomUUID(),
      ...(field ? { field, status: fact?.status ?? 'unknown', value: fact?.value ?? null } : {}),
    };
    setPending(body);
    mutation.mutate(body);
  };
  const refresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        query.refetch(),
        cache.refetchQueries({ queryKey: interviewQuery(id).queryKey, exact: true }),
      ]);
      mutation.reset();
    } finally {
      setRefreshing(false);
    }
  };
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <Notice tone="info">{t('financial.meaning')}</Notice>
      {query.isPending && <SkeletonRows rows={4} />}
      {(query.error || mutation.error || preview.error) && (
        <Notice tone="error">
          {t(conflict ? 'financial.conflict' : 'financial.failed')}
          {mutation.error instanceof ApiError && <p>{errorText(mutation.error.body)}</p>}
        </Notice>
      )}
      {mutation.isPaused && <Notice tone="warn">{t('calculator.offline')}</Notice>}
      <Button
        variant="outline"
        disabled={
          disabled || mutation.isPending || preview.isPending || refreshing || Boolean(pending)
        }
        onClick={() => void refresh()}
      >
        {t('financial.refresh')}
      </Button>
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
          <p>
            {t('financial.basisDate', {
              date: data.assessment_date,
              version: data.policy?.version ?? t('financial.unknown'),
            })}
          </p>
          {data.revision !== revision && <Notice tone="warn">{t('financial.conflict')}</Notice>}
          {data.policy_changed && <Notice tone="warn">{t('financial.policyChanged')}</Notice>}
          {!data.policy && <Notice tone="warn">{t('financial.noPolicy')}</Notice>}
          {data.active_policy && (
            <Button disabled={locked || dirty} onClick={() => send('adopt')}>
              {t('financial.adopt')}
            </Button>
          )}
          {data.policy && (
            <fieldset
              disabled={locked || data.policy_changed}
              className="m-0 flex min-w-0 flex-col gap-4 border-0 p-0"
            >
              <FinancialInputs
                policy={data.policy.bundle}
                value={input ?? data.inputs}
                askExact={Object.values(data.routes).some((r) => r.ask_exact)}
                onChange={(next) => {
                  setInput(next);
                  setScenario(null);
                }}
              />
              {dirty && <Notice tone="warn">{t('calculator.unsaved')}</Notice>}
              {FIELDS.map((field) => (
                <Button
                  key={field}
                  disabled={!input || sameAnswerContent(input[field], data.inputs[field])}
                  onClick={() => send('answer', field)}
                >
                  {t('financial.saveField', {
                    field: t(
                      field === 'proof_family_size'
                        ? 'financial.proofFamilyShort'
                        : `financial.${field}`,
                    ),
                  })}
                </Button>
              ))}
              <SelectField
                label={t('route')}
                value={route}
                options={FINANCIAL_ROUTES.map((r) => ({
                  value: r,
                  label: routeLabels[r] ?? t('financial.unknown'),
                }))}
                onChange={(next) => {
                  setRoute(next);
                  setScenario(null);
                }}
              />
              <Button variant="outline" disabled={!dirty} onClick={() => preview.mutate()}>
                {t('financial.preview')}
              </Button>
            </fieldset>
          )}
          {dirty && !pending && (
            <Button
              variant="outline"
              disabled={mutation.isPending || preview.isPending}
              onClick={() => {
                setInput(null);
                setScenario(null);
              }}
            >
              {t('financial.discardInputs')}
            </Button>
          )}
          {scenario && (
            <Notice tone="info">
              <p>{t('financial.hypothetical')}</p>
              <p>
                {t('before')}: {t(`financial.${scenario.before.status}`)}
              </p>
              <FinancialResult result={scenario.after} />
            </Notice>
          )}
          {data.routes[route] && <FinancialResult result={data.routes[route]} />}
        </>
      )}
    </div>
  );
}
