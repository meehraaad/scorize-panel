import { useSuspenseQuery } from '@tanstack/react-query';
import { useState, type SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  GPA_EXAMPLE,
  GPA_SCALES,
  answersOf,
  draftFrom,
  gpaOn20,
  numberOf,
  type Draft,
} from '@/components/applicant/estimate/draft';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { ChoiceGroup, SelectField, TogglePill } from '@/components/ui/Choices';
import { Icon } from '@/components/ui/Icon';
import { ProgressBar } from '@/components/ui/Progress';
import { TextField } from '@/components/ui/TextField';
import {
  BAND_BAR,
  BAND_TONE,
  estimateOptionsQuery,
  isThrottled,
  latestEstimateQuery,
  useSubmitEstimate,
  type CountryEstimate,
  type EstimateOptions,
} from '@/lib/applicant/estimate';
import { useFormat } from '@/lib/i18n/useFormat';
import { toast } from '@/lib/toast';

type Field = 'field_group' | 'gpa' | 'score';

/** Rows shown veiled before the first answer. */
const VEILED = 4;

/** A country row: its name, the bar, the percentage and level. */
const ROW = { gridTemplateColumns: '76px minmax(0, 1fr) auto' };

/**
 * "Your chance in each country", with what it takes beside the result: the answers the chance
 * reads (prefilled from the profile, as the quiz is) on the start side, the countries and why on
 * the other. Sent through the quiz's endpoint, so the answers land where the quiz's do (the
 * profile, the education degree, `EstimateRequest`), with "don't call me": this form isn't a
 * request for a call. Design: canvas "تب اپلای‌ها و نتایج", بدون قرارداد.
 */
export function ChanceSection() {
  const { t } = useTranslation('applications');
  const { data: options } = useSuspenseQuery(estimateOptionsQuery);
  const { data: latest } = useSuspenseQuery(latestEstimateQuery);
  const [dirty, setDirty] = useState(false);

  return (
    <Card aria-labelledby="apps-chance" className="grid lg:grid-cols-2">
      <AnswersForm
        options={options}
        hasResult={latest !== null}
        dirty={dirty}
        onChange={() => setDirty(latest !== null)}
        onSent={() => setDirty(false)}
      />
      <div aria-live="polite" className="flex min-w-0 flex-col gap-4 p-5 lg:p-8">
        {latest && latest.countries.length > 0 ? (
          <Countries
            countries={latest.countries}
            date={latest.created_at}
            dirty={dirty}
            key={latest.id}
          />
        ) : latest ? (
          <p className="m-0 text-sm leading-7 text-text-2">{t('chance.empty')}</p>
        ) : (
          <Veiled options={options} />
        )}
      </div>
    </Card>
  );
}

function AnswersForm({
  options,
  hasResult,
  dirty,
  onChange,
  onSent,
}: {
  options: EstimateOptions;
  hasResult: boolean;
  dirty: boolean;
  onChange: () => void;
  onSent: () => void;
}) {
  const { t } = useTranslation('applications');
  const { t: te } = useTranslation('estimate');
  const f = useFormat();
  const submit = useSubmitEstimate();
  // Study is this tab's goal; "none": no call is asked for here.
  const [draft, setDraft] = useState<Draft>(() => ({
    ...draftFrom(options.prefill),
    goal: 'study',
    channel: 'none',
  }));
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const exam = options.english_exams.find((item) => item.name === draft.exam);
  const gpaHint = {
    scale: f.number(Number(draft.gpaScale)),
    example: f.number(GPA_EXAMPLE[draft.gpaScale]),
  };
  const missing = [
    !draft.field_group,
    !draft.gpa.trim(),
    draft.english === 'score' && !draft.score.trim(),
  ].filter(Boolean).length;

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    const field = key === 'exam' ? 'score' : key === 'gpaScale' ? 'gpa' : key;
    if (field === 'field_group' || field === 'gpa' || field === 'score')
      setErrors((current) => ({ ...current, [field]: undefined }));
    onChange();
  };

  const send = (event: SubmitEvent) => {
    event.preventDefault();
    const found: Partial<Record<Field, string>> = {};
    if (!draft.field_group) found.field_group = te('quiz.required');
    if (Number.isNaN(gpaOn20(draft))) found.gpa = te('quiz.gpaError', gpaHint);
    if (draft.english === 'score' && exam) {
      const score = numberOf(draft.score);
      if (!(score >= exam.min && score <= exam.max))
        found.score = te('quiz.scoreError', { min: f.number(exam.min), max: f.number(exam.max) });
    }
    setErrors(found);
    const first = (['field_group', 'gpa', 'score'] as const).find((field) => found[field]);
    if (first) {
      document.getElementById(`chance-${first}`)?.focus();
      return;
    }
    submit.mutate(answersOf(draft), {
      onSuccess: onSent,
      onError: (error) => toast.error(te(isThrottled(error) ? 'quiz.throttled' : 'quiz.error')),
    });
  };

  return (
    <form
      noValidate
      onSubmit={send}
      className="flex flex-col gap-5 bg-canvas/60 p-5 lg:border-e lg:border-[var(--hair)] lg:p-8"
    >
      <div className="flex flex-col gap-1">
        <h2 id="apps-chance" className="m-0 font-display text-xl leading-snug font-bold">
          {t('chance.title')}
        </h2>
        <p className="m-0 text-sm leading-7 text-text-2">
          {hasResult ? t('chance.formEdit') : t('chance.formNew')}
        </p>
      </div>
      <ChoiceGroup
        legend={te('quiz.degree')}
        look="segmented"
        options={options.degrees.map((value) => ({ value, label: te(`degree.${value}`) }))}
        value={draft.degree}
        onChange={(value) => set('degree', value)}
      />
      <SelectField
        id="chance-field_group"
        label={te('quiz.field')}
        error={errors.field_group}
        options={[
          { value: '', label: te('quiz.choose') },
          ...options.field_groups.map((group) => ({
            value: String(group.id),
            label: group.name_persian ?? group.name,
          })),
        ]}
        value={draft.field_group}
        onChange={(value) => set('field_group', value)}
      />
      <TextField
        id="chance-gpa"
        label={te('quiz.gpa')}
        hint={te('quiz.gpaHint', gpaHint)}
        inputMode="decimal"
        value={draft.gpa}
        error={errors.gpa}
        onChange={(event) => set('gpa', event.target.value)}
      />
      <ChoiceGroup
        legend={te('quiz.gpaScale')}
        look="segmented"
        options={GPA_SCALES.map((value) => ({
          value,
          label: te('quiz.gpaOf', { scale: f.number(Number(value)) }),
        }))}
        value={draft.gpaScale}
        onChange={(value) => set('gpaScale', value)}
      />
      <SelectField
        label={te('quiz.english')}
        options={(['score', ...options.english_levels] as const).map((value) => ({
          value,
          label: te(`english.${value}`),
        }))}
        value={draft.english}
        onChange={(value) => set('english', value)}
      />
      {draft.english === 'score' && (
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label={te('quiz.exam')}
            options={options.english_exams.map((item) => ({
              value: item.name,
              label: te(`exam.${item.name}`),
            }))}
            value={draft.exam}
            onChange={(value) => set('exam', value)}
          />
          <TextField
            id="chance-score"
            label={te('quiz.score')}
            inputMode="decimal"
            value={draft.score}
            error={errors.score}
            onChange={(event) => set('score', event.target.value)}
          />
        </div>
      )}
      <ChoiceGroup
        legend={te('quiz.budget')}
        look="segmented"
        options={options.budgets.map((value) => ({ value, label: te(`budget.${value}`) }))}
        value={draft.budget}
        onChange={(value) => set('budget', value)}
      />
      <ChoiceGroup
        legend={te('quiz.start')}
        look="segmented"
        options={options.starts.map((value) => ({ value, label: te(`start.${value}`) }))}
        value={draft.start}
        onChange={(value) => set('start', value)}
      />
      <fieldset className="m-0 flex min-w-0 flex-col gap-2.5 border-0 p-0">
        <legend className="mb-2.5 p-0 text-sm font-semibold text-text-2">
          {te('quiz.countries')}
        </legend>
        <div className="flex flex-wrap gap-2">
          {options.countries.map((country) => (
            <TogglePill
              key={country.id}
              label={country.name}
              checked={draft.countries.includes(country.id)}
              onChange={(checked) =>
                set(
                  'countries',
                  checked
                    ? [...draft.countries, country.id]
                    : draft.countries.filter((id) => id !== country.id),
                )
              }
            />
          ))}
        </div>
        <span className="text-sm leading-6 text-text-2">{te('quiz.countriesHint')}</span>
      </fieldset>
      <Button
        type="submit"
        size="lg"
        disabled={submit.isPending || (hasResult && !dirty)}
        className="mt-auto"
      >
        {missing > 0
          ? t('chance.missing', { n: f.number(missing) })
          : hasResult
            ? dirty
              ? t('chance.update')
              : t('chance.current')
            : t('chance.see')}
      </Button>
    </form>
  );
}

/** The countries, best first, each a button that shows why beside or under the list. */
function Countries({
  countries,
  date,
  dirty,
}: {
  countries: CountryEstimate[];
  date: string;
  dirty: boolean;
}) {
  const { t } = useTranslation('applications');
  const { t: te } = useTranslation('estimate');
  const f = useFormat();
  const [picked, setPicked] = useState(0);
  const shown = countries[picked] ?? countries[0];

  return (
    <div className={`flex flex-col gap-4 ${dirty ? 'opacity-60' : ''}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="text-sm font-semibold text-text-2">
          {t('chance.from', { date: f.date(date) })}
        </span>
        {dirty && <span className="text-[13px] font-semibold text-warn">{t('chance.stale')}</span>}
      </div>
      <ul className="m-0 flex list-none flex-col gap-1 p-0">
        {countries.map((country, index) => (
          <li key={country.country.id}>
            <button
              type="button"
              aria-pressed={index === picked}
              onClick={() => setPicked(index)}
              style={ROW}
              className={`grid min-h-14 w-full cursor-pointer items-center gap-4 rounded-2xl px-4 text-start text-text ${
                index === picked ? 'bg-canvas shadow-[inset_0_0_0_1.5px_var(--primary)]' : ''
              }`}
            >
              <span className="font-bold">{country.country.name}</span>
              <ProgressBar
                value={country.chance ?? BAND_BAR[country.band]}
                tone={index === 0 ? 'gold' : 'primary'}
              />
              <span className="flex items-center gap-2">
                {country.chance !== null && (
                  <span className="font-display font-bold">
                    {te('result.percent', { n: f.number(country.chance) })}
                  </span>
                )}
                <Chip tone={BAND_TONE[country.band]} small>
                  {te(`band.${country.band}`)}
                </Chip>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {shown && <Why country={shown} />}
      <p className="m-0 text-[13px] leading-6 text-text-2">{t('chance.disclaimer')}</p>
    </div>
  );
}

/** One country's reasons: what helps, what holds it back, a better score, similar admissions. */
function Why({ country }: { country: CountryEstimate }) {
  const { t } = useTranslation('applications');
  const { t: te } = useTranslation('estimate');
  const f = useFormat();
  const helps = country.factors.filter((factor) => factor.direction === 'up');
  const holds = country.factors.filter((factor) => factor.direction === 'down');

  return (
    <section
      aria-labelledby="apps-chance-why"
      className="flex flex-col gap-3 rounded-[20px] bg-canvas p-5"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 id="apps-chance-why" className="m-0 font-display text-lg font-bold">
          {t('chance.why', { country: country.country.name })}
        </h3>
        <span className="text-[13px] text-text-2">
          {country.decided > 0
            ? te('result.decided', { n: f.number(country.decided) })
            : te('result.fewDecided')}
        </span>
      </div>
      {(helps.length > 0 || holds.length > 0) && (
        <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
          {helps.map((factor) => (
            <li key={factor.name}>
              <Chip tone="good">{t('chance.helps', { factor: te(`factor.${factor.name}`) })}</Chip>
            </li>
          ))}
          {holds.map((factor) => (
            <li key={factor.name}>
              <Chip tone="warn">{t('chance.holds', { factor: te(`factor.${factor.name}`) })}</Chip>
            </li>
          ))}
        </ul>
      )}
      {country.improvements.map((step) => (
        <p key={step.english} className="m-0 text-sm leading-7 font-semibold text-primary-text">
          {te('result.raiseStep', {
            score: f.number(step.english),
            from: te(`band.${step.band_from}`),
            to: te(`band.${step.band_to}`),
          })}
        </p>
      ))}
      {country.similar.length > 0 ? (
        <ul className="m-0 flex list-none flex-col p-0">
          {country.similar.map((admission, index) => (
            <li
              key={`${admission.university}-${String(index)}`}
              className="flex items-center gap-2 py-2.5 text-sm leading-6 shadow-[inset_0_1px_0_var(--hair)]"
            >
              <Icon name="graduation" size={16} className="flex-none text-text-2" />
              <span className="min-w-0 font-semibold" dir="auto">
                {admission.university}
              </span>
              <span className="ms-auto flex-none text-[13px] text-text-2">
                {[admission.field, f.digits(String(admission.year))].filter(Boolean).join(' · ')}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="m-0 text-sm leading-7 text-text-2">{t('chance.noSimilar')}</p>
      )}
    </section>
  );
}

/** Before the first answer: the countries they'd see, their numbers veiled, and what they'd learn. */
function Veiled({ options }: { options: EstimateOptions }) {
  const { t } = useTranslation('applications');
  const names = options.countries.slice(0, VEILED).map((country) => country.name);
  return (
    <>
      <span className="text-sm font-semibold text-text-2">{t('chance.veiledTitle')}</span>
      <ul aria-hidden="true" className="m-0 flex list-none flex-col gap-4 p-0">
        {names.map((name) => (
          <li key={name} style={ROW} className="grid items-center gap-4 px-4">
            <span className="font-bold">{name}</span>
            <span className="h-2 rounded-full bg-track" />
            <span className="h-3 w-12 rounded-full bg-tint" />
          </li>
        ))}
      </ul>
      <ul className="m-0 flex list-none flex-col gap-2 rounded-[20px] bg-tint p-5 text-sm leading-7">
        <li className="font-bold text-primary-text">{t('chance.learnTitle')}</li>
        <li>{t('chance.learn.best')}</li>
        <li>{t('chance.learn.english')}</li>
        <li>{t('chance.learn.similar')}</li>
      </ul>
    </>
  );
}
