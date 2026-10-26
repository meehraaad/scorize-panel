import { useEffect, useState, type SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon, type IconName } from '@/components/ui/Icon';
import { ChoiceGroup, SelectField, TogglePill } from '@/components/ui/Choices';
import { PageColumns } from '@/components/ui/PageColumns';
import { ProgressRing, StepBar } from '@/components/ui/Progress';
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
  type EstimatePrefill,
  type Goal,
  type Start,
} from '@/lib/applicant/estimate';

const STEPS = ['goal', 'background', 'english', 'plan', 'contact'] as const;
type Step = (typeof STEPS)[number];
type EnglishMode = EnglishLevel | 'score';
type Field = 'field_group' | 'gpa' | 'score';
/** What the GPA is out of: typed as on the transcript, sent out of 20. */
type GpaScale = '20' | '4' | '100';
const GPA_SCALES: readonly GpaScale[] = ['20', '4', '100'];
const GPA_EXAMPLE: Record<GpaScale, number> = { '20': 17.5, '4': 3.5, '100': 87.5 };

interface Draft {
  goal: Goal;
  degree: DegreeName;
  field_group: string;
  gpa: string;
  gpaScale: GpaScale;
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
  gpaScale: '20',
  english: 'none',
  exam: 'ielts',
  score: '',
  countries: [],
  budget: 'between_500m_1b',
  start: 'next_year',
  channel: 'call',
  time: 'now',
};

/** The quiz's starting answers: what the profile already holds, the defaults for the rest. */
function draftFrom(prefill: EstimatePrefill): Draft {
  const { english } = prefill;
  return {
    ...FIRST,
    degree: prefill.degree ?? FIRST.degree,
    field_group: prefill.field_group === null ? '' : String(prefill.field_group),
    gpa: prefill.gpa === null ? '' : String(prefill.gpa),
    english: english === null ? FIRST.english : 'level' in english ? english.level : 'score',
    exam: english && 'exam' in english ? english.exam : FIRST.exam,
    score: english && 'exam' in english ? String(english.score) : '',
    budget: prefill.budget ?? FIRST.budget,
    countries: prefill.countries,
  };
}

/** A number typed in Persian or Latin digits, or NaN. */
const numberOf = (text: string) => (text.trim() ? Number(toLatinNumber(text.trim())) : NaN);

/**
 * The GPA out of 20, or NaN. The server reads 0–4 and 20–100 as other scales, so a GPA of 4 or less
 * out of 20 can't be sent: it counts as invalid.
 */
function gpaOn20(draft: Draft) {
  const gpa = numberOf(draft.gpa);
  const scale = Number(draft.gpaScale);
  if (!(gpa > scale / 5 && gpa <= scale)) return NaN;
  return Math.round(gpa * (20 / scale) * 100) / 100;
}

/**
 * The quiz, one short step at a time (one hand on a phone), with a live preview of the answers beside
 * it (under it on phones). The last step sends them, and the step card shows what is being worked
 * out until the result is back; `onDone` gets the contact answer for the result.
 * `inSheet`: inside a bottom sheet (the home on phones): the steps alone, no cards and no preview.
 * Design: the "Scorize New User Dashboard" canvas.
 */
export function Quiz({
  options,
  onDone,
  teaser = false,
  inSheet = false,
}: {
  options: EstimateOptions;
  onDone: (contact: EstimateAnswers['contact']) => void;
  /** First visit on the home: the locked result's shape leads the aside, instead of what they get. */
  teaser?: boolean;
  inSheet?: boolean;
}) {
  const { t } = useTranslation('estimate');
  const f = useFormat();
  const submit = useSubmitEstimate();
  const [step, setStep] = useState<Step>('goal');
  const [draft, setDraft] = useState<Draft>(() => draftFrom(options.prefill));
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const index = STEPS.indexOf(step);
  const exam = options.english_exams.find((item) => item.name === draft.exam);
  const gpaHintValues = {
    scale: f.number(Number(draft.gpaScale)),
    example: f.number(GPA_EXAMPLE[draft.gpaScale]),
  };

  useEffect(() => {
    void markStarted();
  }, []);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    // A field's error goes once it changes (the exam and the scale belong to their number).
    const field = key === 'exam' ? 'score' : key === 'gpaScale' ? 'gpa' : key;
    if (field === 'field_group' || field === 'gpa' || field === 'score')
      setErrors((current) => ({ ...current, [field]: undefined }));
  };

  /** This step's problems (empty: may go on), with focus on the first one. */
  const check = (current: Step) => {
    const found: Partial<Record<Field, string>> = {};
    if (current === 'background') {
      if (!draft.field_group) found.field_group = t('quiz.required');
      if (Number.isNaN(gpaOn20(draft))) found.gpa = t('quiz.gpaError', gpaHintValues);
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
    gpa: gpaOn20(draft),
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

  const stepBar = (
    <StepBar
      label={t('quiz.steps')}
      steps={STEPS.map((key) => ({ key, label: t(`quiz.step.${key}`) }))}
      current={index}
    />
  );
  const counter = t('quiz.counter', { n: f.number(index + 1), total: f.number(STEPS.length) });
  const form = (
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
        <>
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
              hint={t('quiz.gpaHint', gpaHintValues)}
              inputMode="decimal"
              value={draft.gpa}
              error={errors.gpa}
              onChange={(event) => set('gpa', event.target.value)}
            />
          </div>
          <ChoiceGroup
            legend={t('quiz.gpaScale')}
            options={GPA_SCALES.map((value) => ({
              value,
              label: t('quiz.gpaOf', { scale: f.number(Number(value)) }),
            }))}
            value={draft.gpaScale}
            onChange={(value) => set('gpaScale', value)}
          />
        </>
      )}
      {step === 'english' && (
        <>
          <ChoiceGroup
            legend={t('quiz.english')}
            look="tiles"
            hint={t('quiz.englishHint')}
            options={(['score', ...options.english_levels] as const).map((value) => ({
              value,
              label: t(`english.${value}`),
              hint: t(`englishHint.${value}`),
            }))}
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
                  t('quiz.scoreHint', {
                    min: f.number(exam.min),
                    max: f.number(exam.max),
                  })
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
      <div
        className={`flex flex-wrap gap-2 max-sm:[&>*]:flex-auto ${
          inSheet
            ? 'sticky -bottom-6 z-10 -mx-5 -mb-6 bg-surface px-5 pt-3 pb-[calc(16px+env(safe-area-inset-bottom))] shadow-[inset_0_1px_0_var(--hair)]'
            : ''
        }`}
      >
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
        <Button type="submit" size="lg">
          {index < STEPS.length - 1 ? t('quiz.next') : t('quiz.submit')}
        </Button>
      </div>
    </form>
  );

  const question = (
    <section aria-labelledby="estimate-step" className="flex flex-col gap-5 lg:gap-6">
      {stepBar}
      {inSheet && <Answered draft={draft} options={options} fieldName={fieldName} done={index} />}
      <div className="flex flex-col gap-1 pt-5 shadow-[inset_0_1px_0_var(--hair)]">
        <h2
          id="estimate-step"
          tabIndex={-1}
          className="m-0 font-display text-lg font-bold outline-none lg:text-xl"
        >
          {t(`quiz.title.${step}`)}
        </h2>
        <span className="text-sm text-text-2">{counter}</span>
      </div>
      {form}
    </section>
  );

  if (inSheet) return submit.isPending ? <Analysing /> : question;

  return (
    <PageColumns
      asideLabel={t('summary.title')}
      asideWidth="sm"
      main={submit.isPending ? <Analysing /> : <Card className="p-5 lg:p-7">{question}</Card>}
      aside={
        <>
          <LivePreview
            draft={draft}
            options={options}
            fieldName={fieldName}
            complete={Math.round((index / STEPS.length) * 100)}
            locked={teaser}
          />
          {!teaser && <WhatYouGet />}
        </>
      }
    />
  );
}

/**
 * In the sheet, instead of the preview: each answered step as a short chip ("Study · Master's").
 */
function Answered({
  draft,
  options,
  fieldName,
  done,
}: {
  draft: Draft;
  options: EstimateOptions;
  fieldName: (id: number) => string;
  /** How many steps are answered. */
  done: number;
}) {
  const { t } = useTranslation('estimate');
  const f = useFormat();
  if (done === 0) return null;
  const gpa = numberOf(draft.gpa);
  const countries = options.countries
    .filter((country) => draft.countries.includes(country.id))
    .map((country) => country.name);
  const chips: Record<Exclude<Step, 'contact'>, string> = {
    goal: `${t(`goal.${draft.goal}`)} · ${t(`degree.${draft.degree}`)}`,
    background: [
      draft.field_group && fieldName(Number(draft.field_group)),
      Number.isFinite(gpa) && t('answered.gpa', { gpa: f.number(gpa) }),
    ]
      .filter(Boolean)
      .join(' · '),
    english:
      draft.english === 'score'
        ? `${t(`exam.${draft.exam}`)} ${f.number(numberOf(draft.score))}`
        : t(`english.${draft.english}`),
    plan: countries.length ? f.list(countries) : t('answered.allCountries'),
  };
  return (
    <ul aria-label={t('answered.label')} className="m-0 flex list-none flex-wrap gap-1.5 p-0">
      {STEPS.slice(0, done).map(
        (key) =>
          key !== 'contact' && (
            <li
              key={key}
              className="inline-flex h-7 max-w-full items-center gap-1.5 rounded-full bg-tint px-2.5 text-xs font-semibold text-primary-text"
            >
              <Icon name="check" size={12} className="flex-none" />
              <span className="truncate">{chips[key]}</span>
            </li>
          ),
      )}
    </ul>
  );
}

const ANALYSIS = ['background', 'similar', 'consultant'] as const;

/** While the answers are being worked out: what is happening, one line after another. */
function Analysing() {
  const { t } = useTranslation('estimate');
  const [done, setDone] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setDone((current) => Math.min(current + 1, ANALYSIS.length - 1));
    }, 600);
    return () => {
      clearInterval(timer);
    };
  }, []);
  return (
    <section
      aria-labelledby="estimate-analysing"
      aria-live="polite"
      className="flex flex-col gap-5 rounded-[24px] bg-hero px-5 py-7 text-on-hero shadow-hero lg:rounded-[32px] lg:px-9 lg:py-9"
    >
      <span className="text-[13px] font-semibold text-hero-current">{t('analysing.kicker')}</span>
      <h2 id="estimate-analysing" className="m-0 font-display text-[22px] leading-snug font-bold">
        {t('analysing.title')}
      </h2>
      <ul className="m-0 flex list-none flex-col gap-3.5 p-0">
        {ANALYSIS.map((line, index) => (
          <li
            key={line}
            className={`flex items-center gap-3 ${index <= done ? 'text-on-hero' : 'text-on-hero-3'}`}
          >
            <span
              aria-hidden="true"
              className={`flex size-[22px] flex-none items-center justify-center rounded-full ${
                index < done
                  ? 'bg-live text-hero'
                  : index === done
                    ? 'shadow-[inset_0_0_0_2px_var(--hero-current)]'
                    : 'shadow-[inset_0_0_0_2px_var(--hero-line)]'
              }`}
            >
              {index < done && <Icon name="check" size={13} />}
            </span>
            {t(`analysing.${line}`)}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Bar lengths of the locked result: a shape, not anyone's chance. */
const SHAPE = ['w-[88%]', 'w-[70%]', 'w-[62%]', 'w-[44%]'];

/**
 * The live preview on the dark card: how far the quiz is and what it knows so far, as the seller
 * will read it. `locked` (first visit on the home): the result's shape leads it, blurred and
 * locked, on the countries they picked (or the first ones offered). Curiosity about their own
 * numbers is the reason to finish. Design: "Mobile Quiz Card Mockups" canvas, Desktop.
 */
function LivePreview({
  draft,
  options,
  fieldName,
  complete,
  locked = false,
}: {
  draft: Draft;
  options: EstimateOptions;
  fieldName: (id: number) => string;
  /** 0–100: the share of steps answered. */
  complete: number;
  locked?: boolean;
}) {
  const { t } = useTranslation('estimate');
  const f = useFormat();
  const gpa = numberOf(draft.gpa);
  const score = numberOf(draft.score);
  const picked = options.countries.filter((country) => draft.countries.includes(country.id));
  const countries = picked.map((country) => country.name);
  const rows: [string, string][] = [
    [t('summary.goal'), t(`goal.${draft.goal}`)],
    [t('summary.degree'), t(`degree.${draft.degree}`)],
    [t('summary.field'), draft.field_group ? fieldName(Number(draft.field_group)) : '—'],
    [
      t('summary.gpa'),
      Number.isFinite(gpa)
        ? t('summary.gpaOf', { gpa: f.number(gpa), scale: f.number(Number(draft.gpaScale)) })
        : '—',
    ],
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
  const completeText = t('preview.complete', { n: f.number(complete) });
  return (
    <section
      aria-labelledby="estimate-summary"
      className="flex flex-col gap-4 rounded-[24px] bg-hero p-5 text-on-hero shadow-hero lg:p-6"
    >
      <div className="flex items-center gap-4">
        <ProgressRing value={complete} label={completeText} tone="onHero" />
        <div className="flex min-w-0 flex-col">
          <span className="text-[13px] font-semibold text-hero-current">{t('preview.kicker')}</span>
          <h2 id="estimate-summary" className="m-0 text-base font-bold">
            {t(locked ? 'preview.lockedTitle' : 'summary.title')}
          </h2>
          <span aria-hidden="true" className="text-[13px] text-on-hero-2">
            {completeText}
          </span>
        </div>
      </div>
      {locked && (
        <ul
          aria-hidden="true"
          className="m-0 flex list-none flex-col gap-3 rounded-2xl bg-hero-raised p-3.5"
        >
          {(picked.length ? picked : options.countries)
            .slice(0, SHAPE.length)
            .map((country, index) => (
              <li
                key={country.id}
                className="grid grid-cols-[4.5rem_minmax(0,1fr)_auto] items-center gap-2.5 text-sm"
              >
                <span className="truncate font-semibold">{country.name}</span>
                <span className="h-2 rounded-full bg-hero-line">
                  <span
                    className={`block h-full rounded-full bg-hero-accent opacity-75 blur-[2.5px] ${SHAPE[index] ?? ''}`}
                  />
                </span>
                <Icon name="lock" size={14} className="text-on-hero-2" />
              </li>
            ))}
        </ul>
      )}
      <div className="flex flex-col gap-2.5">
        {locked && (
          <h3 className="m-0 text-[13px] font-normal text-on-hero-2">{t('preview.answers')}</h3>
        )}
        <dl
          className={`m-0 flex flex-col gap-2.5 ${locked ? '' : 'pt-4 shadow-[inset_0_1px_0_var(--hero-line)]'}`}
        >
          {rows.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-3 text-sm">
              <dt className="text-on-hero-2">{label}</dt>
              <dd className="m-0 text-end font-semibold">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
      <p className="m-0 pt-3.5 text-[13px] leading-6 text-on-hero-2 shadow-[inset_0_1px_0_var(--hero-line)]">
        {t('summary.note')}
      </p>
    </section>
  );
}

const GETS = [
  { key: 'chance', icon: 'chart' },
  { key: 'consultant', icon: 'user' },
  { key: 'similar', icon: 'graduation' },
] as const satisfies readonly { key: string; icon: IconName }[];

/** What answering gets them: the reason to finish. */
function WhatYouGet() {
  const { t } = useTranslation('estimate');
  return (
    <SectionCard variant="panel" id="estimate-gets" title={t('preview.get.title')}>
      <ul className="m-0 flex list-none flex-col gap-3.5 p-0">
        {GETS.map(({ key, icon }) => (
          <li key={key} className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className="flex size-9 flex-none items-center justify-center rounded-xl bg-tint text-primary-text"
            >
              <Icon name={icon} size={18} />
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="text-sm font-semibold">{t(`preview.get.${key}.title`)}</span>
              <span className="text-[13px] leading-6 text-text-2">
                {t(`preview.get.${key}.text`)}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}
