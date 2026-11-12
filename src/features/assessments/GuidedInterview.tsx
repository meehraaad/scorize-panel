import { useEffect, useId, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { SelectField } from '@/components/ui/Choices';
import { Notice } from '@/components/ui/Notice';
import { SectionCard } from '@/components/ui/SectionCard';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { toast } from '@/lib/toast';
import {
  configureGuidance,
  guidanceQuery,
  interviewQuery,
  type Country,
  type GuidanceQuestion,
  type Interview,
} from './calculatorApi';

export function GuidedInterview({
  id,
  country,
  revision,
  disabled,
  canReview,
  australiaRouteReady,
  onSelect,
  onSkip,
  onBusy,
  onChanged,
  onRestore,
}: {
  id: string;
  country: Country;
  revision: number;
  disabled: boolean;
  canReview: boolean;
  australiaRouteReady: boolean;
  onSelect: (country: Country, question: GuidanceQuestion) => void;
  onSkip: (country: Country, question: GuidanceQuestion) => void;
  onBusy: (busy: boolean) => void;
  onChanged: () => void;
  onRestore: (country: Country) => void;
}) {
  const { t } = useTranslation('assessments');
  const labels = t('calculator.fields', { returnObjects: true }) as Record<string, string>;
  const statuses = t('calculator.guided.statuses', { returnObjects: true }) as Record<
    string,
    string
  >;
  const tiers = t('calculator.guided.tiers', { returnObjects: true }) as Record<string, string>;
  const exclusionReasons = t('calculator.guided.exclusionReasons', {
    returnObjects: true,
  }) as Record<string, string>;
  const sectionId = useId();
  const cache = useQueryClient();
  const query = useQuery(guidanceQuery(id));
  const [mode, setMode] = useState<'assessment' | 'scenario' | null>(null);
  const [pending, setPending] = useState<unknown>(null);
  const [refreshing, setRefreshing] = useState(false);
  const mutation = useMutation({
    mutationFn: (body: unknown) => configureGuidance(id, body),
    onSuccess: (next) => {
      cache.setQueryData(guidanceQuery(id).queryKey, next.guidance);
      cache.setQueryData(interviewQuery(id).queryKey, (old: Interview | undefined) =>
        old ? { ...old, ...next } : old,
      );
      void cache.invalidateQueries({ queryKey: ['calculator-snapshots', id] });
      setPending(null);
      onChanged();
      toast.success(t('calculator.guided.updated'));
    },
  });
  useEffect(() => {
    onBusy(mutation.isPending || refreshing);
    return () => onBusy(false);
  }, [mutation.isPending, refreshing, onBusy]);
  const data = query.data;
  const restored = useRef(false);
  useEffect(() => {
    if (data && !restored.current) {
      restored.current = true;
      if (data.country) onRestore(data.country);
    }
  }, [data, onRestore]);
  const question = data?.next_question;
  const chosenMode = mode ?? data?.mode ?? 'assessment';
  const execute = (action: 'start' | 'stop') => {
    if (!data) return;
    const body = pending ?? {
      country: action === 'stop' ? (data.country ?? country) : country,
      mode: action === 'stop' ? (data.mode ?? chosenMode) : chosenMode,
      action,
      revision,
      request_key: crypto.randomUUID(),
      policy_sha256: data.policy.sha256,
    };
    setPending(body);
    mutation.mutate(body);
  };
  return (
    <SectionCard id={sectionId} title={t('calculator.guided.title')} variant="panel">
      <div className="flex flex-col gap-3">
        <p>{t('calculator.guided.intro')}</p>
        {!data && <SkeletonRows rows={2} />}
        {data && (
          <>
            <p>
              {data.country === 'australia' &&
              !australiaRouteReady &&
              data.status === 'user_requested_result'
                ? t('calculator.guided.routeRequiredPaused')
                : (statuses[data.status] ?? t('calculator.unknown'))}
            </p>
            {data.country && (
              <p>
                {t('calculator.guided.scope', { country: t(`calculator.choices.${data.country}`) })}
              </p>
            )}
            <SelectField
              label={t('calculator.guided.mode')}
              value={chosenMode}
              disabled={
                disabled ||
                mutation.isPending ||
                refreshing ||
                Boolean(pending) ||
                data.status === 'session_complete'
              }
              options={(['assessment', 'scenario'] as const).map((value) => ({
                value,
                label: t(`calculator.guided.${value}`),
              }))}
              onChange={setMode}
            />
            <Button
              disabled={
                disabled ||
                mutation.isPending ||
                refreshing ||
                Boolean(pending) ||
                data.status === 'session_complete'
              }
              onClick={() => execute('start')}
            >
              {t('calculator.guided.start')}
            </Button>
            {data.status !== 'not_started' &&
              data.status !== 'user_requested_result' &&
              data.status !== 'session_complete' && (
                <Button
                  variant="outline"
                  disabled={disabled || mutation.isPending || refreshing || Boolean(pending)}
                  onClick={() => execute('stop')}
                >
                  {t('calculator.guided.stop')}
                </Button>
              )}
            {question && (
              <>
                <h3>{labels[question.field.replaceAll('.', '_')] ?? t('calculator.unknown')}</h3>
                <p>
                  {question.reason === 'source_changed'
                    ? t('calculator.guided.sourceChanged')
                    : question.reason === 'definition_changed'
                      ? t('calculator.guided.definitionChanged')
                      : question.reason === 'incomplete_answer'
                        ? t('calculator.guided.incomplete')
                        : (tiers[String(question.tier)] ?? t('calculator.unknown'))}
                </p>
                {question.missing_paths.length > 0 && (
                  <p>
                    {t('calculator.guided.missing', {
                      fields: question.missing_paths
                        .map(
                          (path) => labels[path.split('.').at(-1) ?? ''] ?? t('calculator.unknown'),
                        )
                        .join(t('separator')),
                    })}
                  </p>
                )}
                <Button
                  disabled={
                    disabled || mutation.isPending || refreshing || revision !== data.revision
                  }
                  onClick={() => {
                    if (data.country) onSelect(data.country, question);
                  }}
                >
                  {t('calculator.guided.answer')}
                </Button>
                <Button
                  variant="outline"
                  disabled={
                    disabled || mutation.isPending || refreshing || revision !== data.revision
                  }
                  onClick={() => {
                    if (data.country) onSkip(data.country, question);
                  }}
                >
                  {t('calculator.guided.skip')}
                </Button>
              </>
            )}
            {(data.deferred?.length ?? 0) > 0 && (
              <p>{t('calculator.guided.deferred', { count: data.deferred?.length })}</p>
            )}
            {canReview && (
              <details>
                <summary className="min-h-11 cursor-pointer py-2">
                  {t('calculator.guided.policy')}
                </summary>
                <p>{data.policy.version}</p>
                <p>{t('calculator.guided.ranking')}</p>
                {data.policy.policy && (
                  <p>
                    {t('calculator.guided.defaultCost', { cost: data.policy.policy.default_cost })}
                  </p>
                )}
                <ul>
                  {Object.entries(data.policy.policy?.costs ?? {}).map(([field, cost]) => (
                    <li key={field}>
                      {t('calculator.guided.cost', {
                        field: labels[field.replaceAll('.', '_')],
                        cost,
                      })}
                    </li>
                  ))}
                </ul>
                <ul>
                  {data.candidates?.map((q) => (
                    <li key={q.field}>
                      {t('calculator.guided.policyRow', {
                        field: labels[q.field.replaceAll('.', '_')],
                        tier: q.tier,
                        cost: q.answer_cost,
                        effects: q.effects.length,
                        shared: q.shared_identity_count,
                      })}
                    </li>
                  ))}
                </ul>
                <ul>
                  {data.blocked?.map((item) => (
                    <li key={item.field}>
                      {t('calculator.guided.blocked', {
                        field: labels[item.field.replaceAll('.', '_')],
                        dependency:
                          labels[item.dependency.replaceAll('.', '_')] ??
                          exclusionReasons[item.dependency] ??
                          t('calculator.unknown'),
                      })}
                    </li>
                  ))}
                </ul>
                <ul>
                  {data.excluded?.map((item) => (
                    <li key={item.field}>
                      {t('calculator.guided.excluded', {
                        field: labels[item.field.replaceAll('.', '_')],
                        reason: exclusionReasons[item.reason] ?? t('calculator.unknown'),
                      })}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </>
        )}
        {(query.error || mutation.error) && (
          <Notice tone="error">{t('calculator.guided.failed')}</Notice>
        )}
        {mutation.isPaused && <Notice tone="warn">{t('calculator.offline')}</Notice>}
        {Boolean(pending) && !mutation.isPending && (
          <Button disabled={disabled || refreshing} onClick={() => mutation.mutate(pending)}>
            {t('calculator.guided.retry')}
          </Button>
        )}
        <Button
          variant="outline"
          disabled={disabled || mutation.isPending || refreshing || query.isFetching}
          onClick={() => {
            setRefreshing(true);
            void Promise.all([
              query.refetch(),
              cache.refetchQueries({ queryKey: interviewQuery(id).queryKey, exact: true }),
            ])
              .then(onChanged)
              .finally(() => setRefreshing(false));
            setPending(null);
            mutation.reset();
          }}
        >
          {t('calculator.guided.reload')}
        </Button>
      </div>
    </SectionCard>
  );
}
