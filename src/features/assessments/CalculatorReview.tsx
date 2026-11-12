import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { Pager } from '@/components/ui/Pager';
import { SectionCard } from '@/components/ui/SectionCard';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { TextAreaField } from '@/components/ui/TextField';
import { toast } from '@/lib/toast';
import {
  reviewCalculation,
  reviewQueueQuery,
  isComparisonSnapshot,
  type Options,
  type Snapshot,
} from './calculatorApi';
import { CalculationResult } from './CalculatorResult';
import { CalculatorForm } from './CalculatorForm';

const DECISIONS = ['facts_reviewed', 'requires_changes'] as const;

function ReviewRecord({ snapshot, options }: { snapshot: Snapshot; options: Options }) {
  const { t } = useTranslation('assessments');
  const labels = t('calculator.fields', { returnObjects: true }) as Record<string, string>;
  const id = useId();
  const [note, setNote] = useState('');
  const cache = useQueryClient();
  const mutation = useMutation({
    mutationFn: (decision: string) => reviewCalculation(snapshot.id, { decision, note }),
    onSuccess: () => {
      setNote('');
      void cache.invalidateQueries({ queryKey: ['calculator-reviews'] });
      toast.success(t('calculator.reviewSaved'));
    },
  });
  const evidence = isComparisonSnapshot(snapshot)
    ? Object.entries(snapshot.payload.evaluations).flatMap(([country, evaluation]) =>
        Object.entries(evaluation.mapping.provenance).map(([field, answer]) => ({
          country: country as keyof Options['schemas'],
          field,
          answer,
        })),
      )
    : Object.entries(snapshot.payload.mapping.provenance ?? {}).map(([field, answer]) => ({
        country: snapshot.payload.country,
        field,
        answer,
      }));
  return (
    <SectionCard id={id} title={t('calculator.reviewRecord', { id: snapshot.id })} variant="panel">
      {snapshot.stale_reasons.length > 0 && <Notice tone="warn">{t('calculator.stale')}</Notice>}
      <p>{t('calculator.factsReviewOnly')}</p>
      <CalculationResult snapshot={snapshot} />
      {evidence.map(({ country, field, answer }) => (
        <details key={country + field}>
          <summary className="min-h-11 cursor-pointer py-2">
            {labels[field.replaceAll('.', '_')] ?? t('calculator.unknown')}
          </summary>
          <p>{t(`calculator.choices.${answer.status}`)}</p>
          {options.schemas[country][field] && answer.status === 'known' && (
            <fieldset disabled>
              <CalculatorForm
                schema={options.schemas[country][field]}
                field={field}
                value={answer.value}
                onChange={() => undefined}
              />
            </fieldset>
          )}
          <p>{t('calculator.unverified')}</p>
        </details>
      ))}
      {snapshot.reviews.map((review) => (
        <p key={review.id}>{review.note}</p>
      ))}
      <TextAreaField
        label={t('calculator.reviewNote')}
        value={note}
        maxLength={4000}
        onChange={(event) => setNote(event.target.value)}
      />
      <div className="flex flex-wrap gap-3">
        {DECISIONS.map((decision) => (
          <Button
            key={decision}
            disabled={!note.trim() || mutation.isPending || snapshot.stale_reasons.length > 0}
            onClick={() => mutation.mutate(decision)}
          >
            {t(`calculator.${decision}`)}
          </Button>
        ))}
      </div>
      {mutation.error && <Notice tone="error">{t('calculator.reviewFailed')}</Notice>}
    </SectionCard>
  );
}

export function CalculatorReview({ options }: { options: Options }) {
  const { t } = useTranslation('assessments');
  const [page, setPage] = useState(1);
  const query = useQuery(reviewQueueQuery(page));
  if (!query.data)
    return (
      <>
        <SkeletonRows rows={4} />
        {query.error && <Notice tone="error">{t('calculator.failed')}</Notice>}
      </>
    );
  return (
    <>
      {query.data.results.map((snapshot) => (
        <ReviewRecord key={snapshot.id} snapshot={snapshot} options={options} />
      ))}
      <Pager
        page={page}
        pages={Math.max(1, Math.ceil(query.data.count / query.data.page_size))}
        onPage={setPage}
      />
    </>
  );
}
