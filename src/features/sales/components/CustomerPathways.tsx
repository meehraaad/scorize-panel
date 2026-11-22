import { useTranslation } from 'react-i18next';
import { Chip, type ChipTone } from '@/components/ui/Chip';
import { SectionCard } from '@/components/ui/SectionCard';
import { useFormat } from '@/lib/i18n/useFormat';
import type { CustomerPathwayCheck, PathwayAnswer } from '../api';

/** Factors whose values are names the pathways namespace words (`choices.<factor>.<value>`). */
const CHOICE_FACTORS = new Set([
  'education',
  'recognition',
  'english_level',
  'german_level',
  'partner',
]);

type Verdict = 'qualifies' | 'eligible' | 'not';

const VERDICT_TONE: Record<Verdict, ChipTone> = {
  qualifies: 'good',
  eligible: 'warn',
  not: 'neutral',
};

const verdictOf = (result: CustomerPathwayCheck['results'][number]): Verdict =>
  result.qualifies ? 'qualifies' : result.eligible ? 'eligible' : 'not';

/**
 * The customer's latest work and migration quiz on the summary tab: each route's verdict and what
 * they answered. Only a record of the quiz: their profile (the details tab) stays as it is.
 */
export function CustomerPathways({ check }: { check: CustomerPathwayCheck }) {
  const { t } = useTranslation('sales');
  const { t: tp } = useTranslation('pathways');
  const f = useFormat();

  const value = (answer: PathwayAnswer) => {
    if (typeof answer.value === 'boolean')
      return t(answer.value ? 'customer.pathways.yes' : 'customer.pathways.no');
    if (typeof answer.value === 'number') return f.number(answer.value);
    if (CHOICE_FACTORS.has(answer.factor))
      return tp(`choices.${answer.factor}.${answer.value}`, { defaultValue: answer.value });
    return answer.value;
  };
  const rows = (answers: PathwayAnswer[]) =>
    answers.map((answer) => ({
      key: answer.factor,
      label: tp(`factors.${answer.factor}`, { defaultValue: answer.factor }),
      value: value(answer),
    }));
  const answered = [
    ...rows(check.answers),
    ...(check.field_group
      ? [{ key: 'field_group', label: tp('factors.field_group'), value: check.field_group }]
      : []),
    ...(check.occupation
      ? [
          {
            key: 'occupation',
            label: t('customer.pathways.occupation'),
            value: check.occupation.name,
          },
        ]
      : []),
    ...(check.budget
      ? [
          {
            key: 'budget',
            label: t('customer.pathways.budget'),
            value: tp(`asks.budget.options.${check.budget}`, { defaultValue: check.budget }),
          },
        ]
      : []),
  ];

  return (
    <SectionCard
      id="customer-pathways"
      variant="panel"
      title={t('customer.pathways.title')}
      end={
        <span className="text-caption text-text-2">
          {t('customer.pathways.taken', { date: f.date(check.created_at) })}
        </span>
      }
    >
      {check.results.length === 0 ? (
        <p className="m-0 text-small text-text-2">{t('customer.pathways.noRoutes')}</p>
      ) : (
        <ul
          aria-label={t('customer.pathways.routes')}
          className="m-0 flex list-none flex-col gap-3 p-0"
        >
          {check.results.map((result) => {
            const verdict = verdictOf(result);
            return (
              <li key={`${result.country}-${result.pathway}`} className="flex flex-col gap-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-small font-semibold">
                    {t('customer.pathways.route', {
                      country: result.country,
                      pathway: result.pathway,
                    })}
                  </span>
                  <span className="flex items-center gap-2">
                    {result.pass_mark ? (
                      <span className="text-caption text-text-2 tabular-nums">
                        {t('customer.pathways.points', {
                          points: f.number(result.points),
                          pass: f.number(result.pass_mark),
                        })}
                      </span>
                    ) : null}
                    <Chip tone={VERDICT_TONE[verdict]} dot small>
                      {t(`customer.pathways.verdict.${verdict}`)}
                    </Chip>
                  </span>
                </div>
                {result.missing.length > 0 && (
                  <span className="text-caption leading-6 text-text-2">
                    {t('customer.pathways.missing', { list: f.list(result.missing) })}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {answered.length > 0 && (
        <dl
          aria-label={t('customer.pathways.answers')}
          className="m-0 grid grid-cols-2 gap-x-4 gap-y-2"
        >
          {answered.map((row) => (
            <div key={row.key} className="flex flex-col">
              <dt className="text-caption text-text-2">{row.label}</dt>
              <dd className="m-0 text-small font-semibold">{row.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {check.by_country.map((row) => (
        <div key={row.country} className="flex flex-col gap-1">
          <span className="text-caption font-semibold text-text-2">
            {t('customer.pathways.about', { country: row.country })}
          </span>
          <span className="text-small">
            {f.list(
              rows(row.answers).map((answer) =>
                t('customer.pathways.pair', { label: answer.label, value: answer.value }),
              ),
            )}
          </span>
        </div>
      ))}
      <p className="m-0 text-caption leading-6 text-text-2">{t('customer.pathways.note')}</p>
    </SectionCard>
  );
}
