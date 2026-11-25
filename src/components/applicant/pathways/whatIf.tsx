import { useMutation } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChoiceGroup } from '@/components/ui/Choices';
import { SkeletonRows } from '@/components/ui/Skeleton';
import type { FinderGiven, PathwayResult } from '@/lib/applicant/pathways';
import { useFormat } from '@/lib/i18n/useFormat';
import { toast } from '@/lib/toast';
import { key } from './keys';
import { whatIfPathways } from './whatIfApi';
import { whatIfChanges, whatIfLines, type WhatIfChange, type WhatIfLine } from './whatIfPlan';

/**
 * "What if…": the person picks one change (IELTS 7, a year more of work) and sees what it opens. Django evaluates
 * it without storing anything, so what sales sees stays what they really answered.
 */
export function WhatIf({
  results,
  given,
}: {
  results: readonly PathwayResult[];
  given: FinderGiven;
}) {
  const { t } = useTranslation('pathways');
  const f = useFormat();
  const changes = whatIfChanges(results, given.answers);
  const titleId = useId();
  const [picked, setPicked] = useState<string | null>(null);
  const [lines, setLines] = useState<WhatIfLine[] | null>(null);
  const tryIt = useMutation({
    mutationFn: (change: WhatIfChange) =>
      whatIfPathways({ ...given, answers: { ...given.answers, [change.factor]: change.value } }),
  });
  if (!changes.length) return null;
  const label = (change: WhatIfChange) =>
    t(key(`improve.${change.factor}`), {
      value:
        change.factor === 'german_level'
          ? t(key(`choices.german_level.${String(change.value)}`))
          : f.number(Number(change.value)),
    });
  const pick = (id: string) => {
    const change = changes.find((candidate) => candidate.id === id);
    if (!change) return;
    setPicked(id);
    setLines(null);
    tryIt.mutate(change, {
      onSuccess: (data) => setLines(whatIfLines(results, data.results)),
      onError: () => toast.error(t('error')),
    });
  };
  return (
    <section
      aria-labelledby={titleId}
      className="flex flex-col gap-4 rounded-3xl bg-surface p-5 shadow-panel lg:p-8"
    >
      <div className="flex flex-col gap-1">
        <h2 id={titleId} className="m-0 text-section font-bold">
          {t('whatif.title')}
        </h2>
        <p className="m-0 text-small text-text-2">{t('whatif.body')}</p>
      </div>
      <ChoiceGroup
        legend={t('whatif.title')}
        hideLegend
        look="chips"
        options={changes.map((change) => ({ value: change.id, label: label(change) }))}
        value={picked}
        onChange={pick}
      />
      <div aria-live="polite">
        {tryIt.isPending ? (
          <SkeletonRows rows={2} />
        ) : lines === null ? null : lines.length === 0 ? (
          <p className="m-0 text-small text-text-2">{t('whatif.nothing')}</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {lines.map((line) => (
              <li key={line.id} className="flex flex-col gap-0.5 rounded-2xl bg-canvas px-4 py-3">
                <span className="text-small font-semibold">
                  {t('peek.route', { country: line.country, name: line.name })}
                </span>
                <span
                  className={`text-small ${line.opens ? 'font-semibold text-good' : 'text-text-2'}`}
                >
                  {[
                    line.opens ? t('whatif.opens') : null,
                    line.points
                      ? t('whatif.points', {
                          from: f.number(line.points[0]),
                          to: f.number(line.points[1]),
                        })
                      : null,
                    line.ranking
                      ? t('whatif.ranking', {
                          from: f.number(line.ranking[0]),
                          to: f.number(line.ranking[1]),
                        })
                      : null,
                  ]
                    .filter((part) => part !== null)
                    .join(t('whatif.separator'))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
