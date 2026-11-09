import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from '@/lib/toast';
import { CHOICES, UnknownNameError, infoQuery, useSaveInfo, type CustomerInfo } from '../api';

/** What the popup asks for when it is missing, most useful first; at most three are offered. */
const ASKS = ['wanted_degree', 'countries', 'budget', 'language'] as const;
type Ask = (typeof ASKS)[number];
/** One tap each; anything else is typed on the customer's info page. */
const COUNTRY_OPTIONS = ['canada', 'germany', 'usa', 'italy'] as const;
const LANGUAGE_OPTIONS = ['none', 'basic', 'certificate'] as const;

/**
 * What we know about the customer, as chips on the call strip, and up to three dashed "+ ..." chips
 * for what is missing. A dashed chip opens one short question with a few answers; a tap saves it to
 * the customer's shared info (the info page's own sections), for the whole team.
 */
export function ProfileChips({ customer, dark = true }: { customer: number; dark?: boolean }) {
  const { t } = useTranslation('sales');
  const { t: tc } = useTranslation('common');
  const { data: info } = useQuery(infoQuery(customer));
  const save = useSaveInfo(customer);
  const [asking, setAsking] = useState<Ask | null>(null);
  if (!info) return null;
  const goal = info.goal;
  const study = info.education.at(-1);
  const exam = info.exams[0];
  const examName = exam && info.exams_list.find((item) => item.value === exam.exam)?.label;
  const known = [
    goal.wanted_degree &&
      tc(`degree.${Number(goal.wanted_degree) as (typeof CHOICES.degree)[number]}`),
    study?.field,
    goal.countries,
    goal.budget &&
      t(`callProfile.budget.${Number(goal.budget) as (typeof CHOICES.budget)[number]}`),
    goal.language || (examName && [examName, exam.score].filter(Boolean).join(' ')),
    study?.gpa && t('callProfile.gpa', { gpa: study.gpa }),
  ].filter((fact): fact is string => !!fact);
  const asks = ASKS.filter((key) => !goal[key]).slice(0, 3);

  const answer = (key: Ask, value: string) => {
    const next: CustomerInfo['goal'] = { ...goal, [key]: value };
    save.mutate(
      { goal: next },
      {
        onSuccess: () => {
          setAsking(null);
          toast.success(t('callProfile.saved'));
        },
        onError: (error) =>
          toast.error(
            error instanceof UnknownNameError
              ? t('info.notFound', { value: error.value })
              : t('error'),
          ),
      },
    );
  };
  const options = (key: Ask): { value: string; label: string }[] =>
    key === 'wanted_degree'
      ? CHOICES.degree.map((code) => ({ value: String(code), label: tc(`degree.${code}`) }))
      : key === 'budget'
        ? CHOICES.budget.map((code) => ({
            value: String(code),
            label: t(`callProfile.budget.${code}`),
          }))
        : key === 'countries'
          ? COUNTRY_OPTIONS.map((code) => {
              const label = t(`callProfile.country.${code}`);
              return { value: label, label };
            })
          : LANGUAGE_OPTIONS.map((code) => {
              const label = t(`callProfile.language.${code}`);
              return { value: label, label };
            });

  if (!known.length && !asks.length) return null;
  const fact = dark ? 'bg-hero-raised text-on-hero' : 'bg-surface text-text';
  const dashed = dark
    ? 'text-hero-accent shadow-[inset_0_0_0_1px_var(--hero-line)] hover:bg-hero-raised'
    : 'text-primary-text shadow-[inset_0_0_0_1px_var(--line-3)] hover:bg-surface';
  return (
    <div className="flex flex-col gap-2">
      <ul
        aria-label={t('callProfile.title')}
        className="m-0 flex list-none flex-wrap gap-1.5 p-0 text-xs"
      >
        {known.map((item) => (
          <li key={item} className={`max-w-full truncate rounded-full px-2.5 py-1.5 ${fact}`}>
            {item}
          </li>
        ))}
        {asks.map((key) => (
          <li key={key}>
            <button
              type="button"
              aria-expanded={asking === key}
              onClick={() => setAsking(asking === key ? null : key)}
              className={`min-h-8 rounded-full px-2.5 font-semibold ${
                asking === key ? 'bg-hero-accent text-hero' : dashed
              }`}
            >
              {t('callProfile.ask', { what: t(`callProfile.field.${key}`) })}
            </button>
          </li>
        ))}
      </ul>
      {asking && (
        <fieldset
          disabled={save.isPending}
          className={`m-0 flex min-w-0 flex-wrap items-center gap-1.5 rounded-xl border-0 p-2 ${dark ? 'bg-hero-raised' : 'bg-surface'}`}
        >
          <legend className="sr-only">{t(`callProfile.question.${asking}`)}</legend>
          <span aria-hidden="true" className="px-1.5 text-xs font-semibold">
            {t(`callProfile.question.${asking}`)}
          </span>
          {options(asking).map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() =>
                answer(
                  asking,
                  asking === 'countries' && goal.countries
                    ? `${goal.countries}، ${option.value}`
                    : option.value,
                )
              }
              className={`min-h-9 rounded-full px-3 text-xs ${dark ? 'bg-hero text-on-hero hover:bg-hero-line' : 'bg-canvas hover:bg-tint'}`}
            >
              {option.label}
            </button>
          ))}
        </fieldset>
      )}
    </div>
  );
}
