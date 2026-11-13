import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { TogglePill } from '@/components/ui/Choices';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Notice } from '@/components/ui/Notice';
import { SectionCard } from '@/components/ui/SectionCard';
import { safeHref } from '@/lib/url';
import { buttonClass } from '@/components/ui/buttonStyles';
import { DestinationPlan } from './DestinationPlan';
import { FinancialResult } from './FinancialResult';
import { INTAKE_FIELDS, type DestinationResult, type DestinationSnapshot } from './destinationApi';
export function DestinationReport({
  data,
  readOnly = false,
  interactionDisabled = false,
  onSelect,
}: {
  data: DestinationResult | DestinationSnapshot['payload'];
  readOnly?: boolean;
  interactionDisabled?: boolean;
  onSelect?: (routes: string[]) => void;
}) {
  const { t, i18n } = useTranslation('assessments');
  const selected = data.plan?.selected_routes ?? [];
  const [showOutside, setShowOutside] = useState(readOnly);
  const entries = showOutside
    ? data.entries
    : data.entries.filter((e) => e.relevance !== 'outside_stated_goals');
  const regions = new Intl.DisplayNames([i18n.language], { type: 'region' });
  const summaryValue = (field: (typeof INTAKE_FIELDS)[number]) => {
    const fact = data.intake.inputs[field];
    if (!fact || fact.status !== 'known')
      return t(`calculator.choices.${fact?.status ?? 'unknown'}`);
    const values = Array.isArray(fact.value) ? fact.value : fact.value ? [fact.value] : [];
    if (field === 'destinations' && !values.length) return t('destinations.openCountries');
    return values
      .map((v) =>
        field === 'goals'
          ? (t('destinations.goals', { returnObjects: true }) as Record<string, string>)[v]
          : field === 'timeline'
            ? (t('destinations.timeline', { returnObjects: true }) as Record<string, string>)[v]
            : regions.of(v),
      )
      .join(t('separator'));
  };
  const words = t('destinations.words', { returnObjects: true }) as Record<string, string>;
  const actions = t('destinations.actions', { returnObjects: true }) as Record<string, string>;
  const label = (key: string) => words[key] ?? t('calculator.unknown');
  const language = i18n.language === 'fa' ? 'fa' : 'en';
  const requirementLabel = (v: boolean | string | null) =>
    label(v === true ? 'met' : v === false ? 'unmet' : typeof v === 'string' ? v : 'unknown');
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <Notice tone="warn">{t('destinations.meaning')}</Notice>
      <p>
        {t('destinations.basis', {
          date: data.assessment_date,
          version: data.intake.catalog?.version ?? t('calculator.unknown'),
        })}
      </p>
      {!!data.coverage_gaps?.length && (
        <Notice tone="info">
          {t('destinations.coverageGaps', {
            countries: data.coverage_gaps.map((c) => regions.of(c)).join(t('separator')),
          })}
        </Notice>
      )}
      {data.intake.catalog_changed && (
        <Notice tone="warn">{t('destinations.catalogChanged')}</Notice>
      )}
      <details>
        <summary className="min-h-11 cursor-pointer py-2">{t('destinations.inputSummary')}</summary>
        <ul>
          {INTAKE_FIELDS.map((field) => (
            <li key={field}>
              {t(`destinations.fields.${field}`)}: {summaryValue(field)}
            </li>
          ))}
        </ul>
        <p>{t('destinations.provenance')}</p>
      </details>
      {data.entries.some((e) => e.relevance === 'outside_stated_goals') && (
        <TogglePill
          label={t('destinations.showOutside')}
          checked={showOutside}
          onChange={setShowOutside}
        />
      )}
      {entries.length === 0 && data.entries.length > 0 && (
        <Notice tone="info">{t('destinations.noGoalOptions')}</Notice>
      )}
      {data.entries.length === 0 && <Notice tone="info">{t('destinations.noOptions')}</Notice>}
      <div className="grid gap-4 md:grid-cols-2">
        {entries.map((entry) => (
          <article
            key={entry.id}
            className="border-line min-w-0 rounded-2xl border p-4 break-words"
          >
            <h3 className="font-bold">{entry.title[language]}</h3>
            {!readOnly && onSelect && data.plan && (
              <Button
                variant="outline"
                disabled={
                  interactionDisabled ||
                  (!data.plan.selected_routes.includes(entry.id) &&
                    data.plan.selected_routes.length >= data.plan.max_routes)
                }
                onClick={() =>
                  onSelect(
                    selected.includes(entry.id)
                      ? selected.filter((id) => id !== entry.id)
                      : [...selected, entry.id],
                  )
                }
              >
                {t(
                  data.plan.selected_routes.includes(entry.id)
                    ? 'destinationPlan.unselectOption'
                    : 'destinationPlan.selectOption',
                  { title: entry.title[language] },
                )}
              </Button>
            )}
            <p>
              {t('destinations.preference')}: {label(entry.relevance)}
            </p>
            <p>
              {t('destinations.alignment', {
                earned: entry.preference_alignment.earned,
                total: entry.preference_alignment.possible,
              })}
            </p>
            {!entry.preference_alignment.complete && <p>{t('destinations.incompleteAlignment')}</p>}
            <ul className="list-inside list-disc">
              {entry.preference_alignment.checks.map((check) => (
                <li key={check.criterion}>
                  {t('destinations.check', {
                    criterion: words[check.criterion],
                    weight: check.weight,
                    result: label(
                      check.matched === null
                        ? 'unknown'
                        : check.matched
                          ? 'matched'
                          : 'not_matched',
                    ),
                  })}
                </li>
              ))}
            </ul>
            <p className="mt-3 font-semibold">
              {t('destinations.legal')}: {label(entry.eligibility.status)}
            </p>
            {entry.eligibility.reason && <p>{label(entry.eligibility.reason)}</p>}
            {entry.eligibility.coverage && (
              <p>
                {t('destinations.coverage', {
                  from: entry.eligibility.coverage.from,
                  through: entry.eligibility.coverage.through,
                })}
              </p>
            )}
            {entry.eligibility.score && (
              <p>
                {t('destinations.score', {
                  system: entry.eligibility.score.system,
                  score: entry.eligibility.score.score ?? t('calculator.partial'),
                })}
              </p>
            )}
            {entry.eligibility.requirements && (
              <details>
                <summary className="min-h-11 cursor-pointer py-2">
                  {t('destinations.requirements')}
                </summary>
                <ul>
                  {Object.entries(entry.eligibility.requirements).map(([key, v]) => (
                    <li key={key}>
                      {(t('comparison.labels', { returnObjects: true }) as Record<string, string>)[
                        key
                      ] ?? key}
                      : {requirementLabel(v)}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            <FinancialResult result={entry.financial} />
            <p className="mt-3">{label(entry.directory_status)}</p>
            <a href={safeHref(entry.source.url)} className="underline">
              {entry.source.title}
            </a>
            <p className="text-sm text-text-2">
              {t('destinations.sourceDates', {
                checked: entry.source.checked_on,
                due: entry.source.review_due,
                received: entry.source.received_at,
                effective: entry.source.effective_on ?? t('calculator.unknown'),
              })}
            </p>
            <details>
              <summary className="min-h-11 cursor-pointer py-2">
                {t('destinations.nextActions')}
              </summary>
              <ul className="list-inside list-disc">
                {entry.next_actions.map((action) => (
                  <li key={action}>{actions[action] ?? t('destinations.specialist')}</li>
                ))}
              </ul>
            </details>
            {!readOnly &&
              !interactionDisabled &&
              entry.calculator_route &&
              entry.eligibility.reason !== 'legal_date_out_of_coverage' &&
              entry.directory_status === 'reviewed_directory' && (
                <Link
                  className={buttonClass('outline', 'mt-3')}
                  to={`/dev/assessment-calculators?session=${encodeURIComponent(data.context.session_id)}&country=${entry.country === 'CA' ? 'canada' : 'australia'}&route=${encodeURIComponent(entry.calculator_route)}`}
                >
                  {t('destinations.openInterview')}
                </Link>
              )}
          </article>
        ))}
      </div>
      {readOnly && <DestinationPlan data={data} disabled />}
    </div>
  );
}
export function DestinationSaved({ snapshot }: { snapshot: DestinationSnapshot }) {
  const { t } = useTranslation('assessments');
  return (
    <SectionCard
      id={`destination-snapshot-${snapshot.id}`}
      title={t('destinations.savedShortlist')}
      variant="panel"
    >
      {snapshot.stale_reasons.length > 0 && <Notice tone="warn">{t('calculator.stale')}</Notice>}
      <DestinationReport data={snapshot.payload} readOnly />
    </SectionCard>
  );
}

export function DestinationReplay({ snapshot }: { snapshot: DestinationSnapshot }) {
  const { t } = useTranslation('assessments');
  const replay = useMutation({
    mutationFn: () =>
      api<{ matches: boolean }>(
        `/applicant/v1/assessments/${snapshot.payload.context.session_id}/calculators/snapshots/${snapshot.id}/replay/`,
        { method: 'POST' },
      ),
  });
  return (
    <div className="my-3 flex flex-col gap-3">
      <Button variant="outline" disabled={replay.isPending} onClick={() => replay.mutate()}>
        {t('destinations.replay')}
      </Button>
      {replay.data?.matches && <Notice tone="info">{t('destinations.replayMatched')}</Notice>}
      {replay.error && <Notice tone="warn">{t('destinations.replayUnavailable')}</Notice>}
    </div>
  );
}
