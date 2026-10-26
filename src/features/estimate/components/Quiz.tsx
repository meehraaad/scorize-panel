import { useEffect, useState, type SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ChoiceGroup, SelectField, TogglePill } from '@/components/ui/Choices';
import { PageColumns } from '@/components/ui/PageColumns';
import { StepBar } from '@/components/ui/Progress';
import { SectionCard } from '@/components/ui/SectionCard';
import { TextField } from '@/components/ui/TextField';
import { useFormat } from '@/lib/i18n/useFormat';
import { toLatinNumber } from '@/lib/text';
import { toast } from '@/lib/toast';
import {
  isThrottled,
  markStarted,
  useSubmitEstimate,
  type Budget,
  type ContactChannel,
  type ContactTime,
  type DegreeName,
  type EnglishExam,
  type EnglishLevel,
  type EstimateAnswers,
  type EstimateOptions,
  type Goal,
  type Start,
} from '@/lib/applicant/estimate';

const STEPS = ['goal', 'background', 'english', 'plan', 'contact'] as const;
type Step = (typeof STEPS)[number];
type EnglishMode = EnglishLevel | 'score';
type Field = 'field_group' | 'gpa' | 'score';

interface Draft {
  goal: Goal;
  degree: DegreeName;
  field_group: string;
  gpa: string;
  english: EnglishMode;
  exam: EnglishExam;
  score: string;
  countries: number[];
  budget: Budget;
  start: Start;
  channel: ContactChannel;
  time: ContactTime;
}

const FIRST: Draft = {
  goal: 'study',
  degree: 'master',
  field_group: '',
  gpa: '',
  english: 'none',
  exam: 'ielts',
  score: '',
  countries: [],
  budget: 'between_500m_1b',
  start: 'next_year',
  channel: 'call',
  time: 'now',
};

/** A number typed in Persian or Latin digits, or NaN. */
const numberOf = (text: string) => (text.trim() ? Number(toLatinNumber(text.trim())) : NaN);

/**
 * The quiz, one short step at a time (one hand on a phone), with the answers so far beside it (under
 * it on phones). The last step sends them; `onDone` gets the contact answer for the result page.
 */
export function Quiz({
  options,
  onDone,
}: {
  options: EstimateOptions;
  onDone: (contact: EstimateAnswers['contact']) => void;
}) {
  const { t } = useTranslation('estimate');
  const f = useFormat();
  const submit = useSubmitEstimate();
  const [step, setStep] = useState<Step>('goal');
  const [draft, setDraft] = useState<Draft>(FIRST);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const index = STEPS.indexOf(step);
  const exam = options.english_exams.find((item) => item.name === draft.exam);

  useEffect(() => {
    void markStarted();
  }, []);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    if (key === 'field_group' || key === 'gpa' || key === 'score' || key === 'exam')
      setErrors((current) => ({ ...current, [key === 'exam' ? 'score' : key]: undefined }));
  };

  /** This step's problems (empty: may go on), with focus on the first one. */
  const check = (current: Step) => {
    const found: Partial<Record<Field, string>> = {};
    if (current === 'background') {
      if (!draft.field_group) found.field_group = t('quiz.required');
      const gpa = numberOf(draft.gpa);
      if (!(gpa > 0 && gpa <= 100)) found.gpa = t('quiz.gpaError');
    }
    if (current === 'english' && draft.english === 'score' && exam) {
      const score = numberOf(draft.score);
      if (!(score >= exam.min && score <= exam.max))
        found.score = t('quiz.scoreError', { min: f.number(exam.min), max: f.number(exam.max) });
    }
    setErrors(found);
    const first = (['field_group', 'gpa', 'score'] as const).find((field) => found[field]);
    if (first) document.getElementById(`estimate-${first}`)?.focus();
    return !first;
  };

  const answers = (): EstimateAnswers => ({
    goal: draft.goal,
    degree: draft.degree,
    field_group: Number(draft.field_group),
    gpa: numberOf(draft.gpa),
    english:
      draft.english === 'score'
        ? { exam: draft.exam, score: numberOf(draft.score) }
        : { level: draft.english },
    budget: draft.budget,
    countries: draft.countries,
    start: draft.start,
    contact:
      draft.channel === 'none' ? { channel: 'none' } : { channel: draft.channel, time: draft.time },
  });

  const next = (event: SubmitEvent) => {
    event.preventDefault();
    if (!check(step)) return;
    const following = STEPS[index + 1];
    if (following) {
      setStep(following);
      document.getElementById('estimate-step')?.focus();
      return;
    }
    const sent = answers();
    submit.mutate(sent, {
      onSuccess: () => onDone(sent.contact),
      onError: (error) => toast.error(t(isThrottled(error) ? 'quiz.throttled' : 'quiz.error')),
    });
  };

  const fieldName = (id: number) => {
    const group = options.field_groups.find((item) => item.id === id);
    return group ? (group.name_persian ?? group.name) : '';
  };

  return (
    <div className="flex flex-col gap-4 lg:gap-7">
      <Card className="flex flex-col gap-4 p-5 lg:px-7">
        <StepBar
          label={t('quiz.steps')}
          steps={STEPS.map((key) => ({ key, label: t(`quiz.step.${key}`) }))}
          current={index}
        />
      </Card>
      <PageColumns
        asideLabel={t('summary.title')}
        asideWidth="sm"
        main={
          <SectionCard
            variant="panel"
            size="lg"
            id="estimate-step"
            title={t(`quiz.title.${step}`)}
            subtitle={t('quiz.counter', { n: f.number(index + 1), total: f.number(STEPS.length) })}
          >
            <form noValidate onSubmit={next} className="flex flex-col gap-6">
              {step === 'goal' && (
                <>
                  <ChoiceGroup
                    legend={t('quiz.goal')}
                    look="tiles"
                    options={options.goals.map((value) => ({
                      value,
                      label: t(`goal.${value}`),
                      hint: t(`goalHint.${value}`),
                    }))}
                    value={draft.goal}
                    onChange={(value) => set('goal', value)}
                  />
                  <ChoiceGroup
                    legend={t('quiz.degree')}
                    options={options.degrees.map((value) => ({
                      value,
                      label: t(`degree.${value}`),
                    }))}
                    value={draft.degree}
                    onChange={(value) => set('degree', value)}
                  />
                </>
              )}
              {step === 'background' && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <SelectField
                    id="estimate-field_group"
                    label={t('quiz.field')}
                    error={errors.field_group}
                    options={[
                      { value: '', label: t('quiz.choose') },
                      ...options.field_groups.map((group) => ({
                        value: String(group.id),
                        label: group.name_persian ?? group.name,
                      })),
                    ]}
                    value={draft.field_group}
                    onChange={(value) => set('field_group', value)}
                  />
                  <TextField
                    id="estimate-gpa"
                    label={t('quiz.gpa')}
                    hint={t('quiz.gpaHint')}
                    inputMode="decimal"
                    value={draft.gpa}
                    error={errors.gpa}
                    onChange={(event) => set('gpa', event.target.value)}
                  />
                </div>
              )}
              {step === 'english' && (
                <>
                  <ChoiceGroup
                    legend={t('quiz.english')}
                    options={[
                      ...options.english_levels.map((value) => ({
                        value,
                        label: t(`english.${value}`),
                      })),
                      { value: 'score', label: t('english.score') },
                    ]}
                    value={draft.english}
                    onChange={(value) => set('english', value)}
                  />
                  {draft.english === 'score' && (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <SelectField
                        label={t('quiz.exam')}
                        options={options.english_exams.map((item) => ({
                          value: item.name,
                          label: t(`exam.${item.name}`),
                        }))}
                        value={draft.exam}
                        onChange={(value) => set('exam', value)}
                      />
                      <TextField
                        id="estimate-score"
                        label={t('quiz.score')}
                        hint={
                          exam &&
                          t('quiz.scoreHint', { min: f.number(exam.min), max: f.number(exam.max) })
                        }
                        inputMode="decimal"
                        value={draft.score}
                        error={errors.score}
                        onChange={(event) => set('score', event.target.value)}
                      />
                    </div>
                  )}
                </>
              )}
              {step === 'plan' && (
                <>
                  <fieldset className="m-0 flex min-w-0 flex-col gap-2.5 border-0 p-0">
                    <legend className="mb-2.5 p-0 text-sm font-semibold text-text-2">
                      {t('quiz.countries')}
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
                    <span className="text-sm leading-6 text-text-2">{t('quiz.countriesHint')}</span>
                  </fieldset>
                  <ChoiceGroup
                    legend={t('quiz.budget')}
                    options={options.budgets.map((value) => ({
                      value,
                      label: t(`budget.${value}`),
                    }))}
                    value={draft.budget}
                    onChange={(value) => set('budget', value)}
                  />
                  <ChoiceGroup
                    legend={t('quiz.start')}
                    options={options.starts.map((value) => ({
                      value,
                      label: t(`start.${value}`),
                    }))}
                    value={draft.start}
                    onChange={(value) => set('start', value)}
                  />
                </>
              )}
              {step === 'contact' && (
                <>
                  <ChoiceGroup
                    legend={t('quiz.channel')}
                    look="tiles"
                    options={options.contact_channels.map((value) => ({
                      value,
                      label: t(`channel.${value}`),
                      hint: t(`channelHint.${value}`),
                    }))}
                    value={draft.channel}
                    onChange={(value) => set('channel', value)}
                  />
                  {draft.channel !== 'none' && (
                    <ChoiceGroup
                      legend={t('quiz.time')}
                      options={options.contact_times.map((value) => ({
                        value,
                        label: t(`time.${value}`),
                      }))}
                      value={draft.time}
                      onChange={(value) => set('time', value)}
                    />
                  )}
                </>
              )}
              <div className="flex flex-wrap gap-2 max-sm:[&>*]:flex-auto">
                {index > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    onClick={() => {
                      setStep(STEPS[index - 1] ?? 'goal');
                      setErrors({});
                    }}
                  >
                    {t('quiz.back')}
                  </Button>
                )}
                <Button type="submit" size="lg" disabled={submit.isPending}>
                  {index < STEPS.length - 1
                    ? t('quiz.next')
                    : submit.isPending
                      ? t('quiz.sending')
                      : t('quiz.submit')}
                </Button>
              </div>
            </form>
          </SectionCard>
        }
        aside={<Summary draft={draft} options={options} fieldName={fieldName} />}
      />
    </div>
  );
}

/** The live preview: what the quiz knows so far, as the seller will read it. */
function Summary({
  draft,
  options,
  fieldName,
}: {
  draft: Draft;
  options: EstimateOptions;
  fieldName: (id: number) => string;
}) {
  const { t } = useTranslation('estimate');
  const f = useFormat();
  const gpa = numberOf(draft.gpa);
  const score = numberOf(draft.score);
  const countries = options.countries
    .filter((country) => draft.countries.includes(country.id))
    .map((country) => country.name);
  const rows: [string, string][] = [
    [t('summary.goal'), t(`goal.${draft.goal}`)],
    [t('summary.degree'), t(`degree.${draft.degree}`)],
    [t('summary.field'), draft.field_group ? fieldName(Number(draft.field_group)) : '—'],
    [t('summary.gpa'), Number.isFinite(gpa) ? f.number(gpa) : '—'],
    [
      t('summary.english'),
      draft.english === 'score'
        ? Number.isFinite(score)
          ? `${t(`exam.${draft.exam}`)} ${f.number(score)}`
          : t(`exam.${draft.exam}`)
        : t(`english.${draft.english}`),
    ],
    [t('summary.countries'), countries.length ? f.list(countries) : t('summary.allCountries')],
    [t('summary.budget'), t(`budget.${draft.budget}`)],
  ];
  return (
    <SectionCard variant="panel" id="estimate-summary" title={t('summary.title')}>
      <dl className="m-0 flex flex-col gap-3">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-3 text-sm">
            <dt className="text-text-2">{label}</dt>
            <dd className="m-0 text-end font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="m-0 text-[13px] leading-6 text-text-2">{t('summary.note')}</p>
    </SectionCard>
  );
}
