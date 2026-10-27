import { useEffect, useState, type SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { ChoiceGroup, SelectField, TogglePill } from '@/components/ui/Choices';
import { ProgressRing } from '@/components/ui/Progress';
import { TextField } from '@/components/ui/TextField';
import { useFormat } from '@/lib/i18n/useFormat';
import { toLatinNumber } from '@/lib/text';
import { toast } from '@/lib/toast';
import type { Referral } from '@/lib/account/api';
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
  /** Optional: none picked sends none. */
  referral: Referral | null;
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
  referral: null,
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
 * The quiz, one short step at a time (one hand on a phone), each step's heading its question, with
 * the locked result and the answers so far beside it on the premium card (under it on phones). The
 * last step sends them, and the card shows what is being worked out until the result is back;
 * `onDone` gets the contact answer for the result.
 * `inSheet`: inside a bottom sheet (the home on phones): the steps alone, no cards and no preview.
 * Design: "کوییز شانس قبولی" canvas.
 */
export function Quiz({
  options,
  onDone,
  inSheet = false,
}: {
  options: EstimateOptions;
  onDone: (contact: EstimateAnswers['contact']) => void;
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
    ...(draft.referral && { referral: draft.referral }),
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

  const steps = (
    <ol
      aria-label={t('quiz.steps')}
      className="m-0 grid list-none grid-cols-5 gap-1.5 p-0 max-sm:gap-1"
    >
      {STEPS.map((key, position) => (
        <li
          key={key}
          aria-current={position === index ? 'step' : undefined}
          className={`flex flex-col gap-2 text-xs ${
            position === index
              ? 'font-extrabold text-text'
              : position < index
                ? 'font-semibold text-primary-text'
                : 'text-text-2'
          }`}
        >
          <span
            aria-hidden="true"
            className={`h-1 rounded-full ${
              position < index ? 'bg-primary' : position === index ? 'bg-primary/45' : 'bg-track'
            }`}
          />
          <span className={inSheet ? 'sr-only' : ''}>{t(`quiz.step.${key}`)}</span>
        </li>
      ))}
    </ol>
  );
  const form = (
    <form noValidate onSubmit={next} className="flex flex-col gap-6">
      {step === 'goal' && (
        <>
          <ChoiceGroup
            legend={t('quiz.goal')}
            look="cards"
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
            look="segmented"
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
            look="segmented"
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
            look="cards"
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
            look="segmented"
            options={options.budgets.map((value) => ({
              value,
              label: t(`budget.${value}`),
            }))}
            value={draft.budget}
            onChange={(value) => set('budget', value)}
          />
          <ChoiceGroup
            legend={t('quiz.start')}
            look="segmented"
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
            look="cards"
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
              look="segmented"
              options={options.contact_times.map((value) => ({
                value,
                label: t(`time.${value}`),
              }))}
              value={draft.time}
              onChange={(value) => set('time', value)}
            />
          )}
          {/* The account's "how did you hear about us", asked here until answered. */}
          {options.prefill.referral === null && (
            <ChoiceGroup
              legend={t('quiz.referral')}
              hint={t('quiz.referralHint')}
              options={options.referrals.map((value) => ({
                value,
                label: t(`referral.${value}`),
              }))}
              value={draft.referral}
              onChange={(value) => set('referral', value)}
            />
          )}
        </>
      )}
      <div
        className={`flex items-center justify-between gap-2 pt-5 shadow-[inset_0_1px_0_var(--hair)] ${
          inSheet
            ? 'sticky -bottom-6 z-10 -mx-5 -mb-6 bg-surface px-5 pt-3 pb-[calc(16px+env(safe-area-inset-bottom))]'
            : ''
        }`}
      >
        {index > 0 ? (
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="max-sm:flex-1"
            onClick={() => {
              setStep(STEPS[index - 1] ?? 'goal');
              setErrors({});
            }}
          >
            {t('quiz.back')}
          </Button>
        ) : (
          <span />
        )}
        <Button type="submit" size="lg" className="max-sm:flex-[2] sm:min-w-44">
          {index < STEPS.length - 1 ? t('quiz.next') : t('quiz.submit')}
          <Icon name="chevronEnd" size={18} />
        </Button>
      </div>
    </form>
  );

  const question = (
    <section aria-labelledby="estimate-step" className="flex flex-col gap-6 lg:gap-7">
      <div className="flex flex-col gap-3">
        {inSheet && (
          <span className="text-[13px] font-bold text-text-2">
            {t('quiz.counterStep', {
              n: f.number(index + 1),
              total: f.number(STEPS.length),
              step: t(`quiz.step.${step}`),
            })}
          </span>
        )}
        {steps}
      </div>
      {inSheet && <Answered draft={draft} options={options} fieldName={fieldName} done={index} />}
      <h2
        id="estimate-step"
        tabIndex={-1}
        className="m-0 font-display text-xl leading-relaxed font-semibold outline-none lg:text-[25px]"
      >
        {t(`quiz.title.${step}`)}
      </h2>
      {form}
    </section>
  );

  if (inSheet) return submit.isPending ? <Analysing /> : question;
  if (submit.isPending) return <Analysing />;

  return (
    <Card className="flex flex-col overflow-hidden lg:flex-row">
      <div className="min-w-0 p-5 lg:flex-1 lg:px-11 lg:py-9">{question}</div>
      <LivePreview draft={draft} options={options} fieldName={fieldName} done={index} />
    </Card>
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
      className="flex flex-col gap-5 rounded-[24px] px-5 py-7 text-on-hero shadow-luxe bg-luxe lg:rounded-[32px] lg:px-9 lg:py-9"
    >
      <span className="text-[13px] font-semibold text-luxe-gold-light">
        {t('analysing.kicker')}
      </span>
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
                    ? 'shadow-[inset_0_0_0_2px_var(--luxe-gold)]'
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

/** The locked chances' look: a shape, blurred, not anyone's chance. */
const VEILED = [78, 64, 51, 39];
/** What each step's answer lets the result tell them: the reason to go on. */
const TEASES = ['country', 'gpa', 'english', 'budget', 'consultant'] as const;

/**
 * Beside the questions, on the premium card: the result locked (their countries, the chances
 * blurred), what the next answers will tell them, and their answers so far as the seller will read
 * them. Curiosity about their own numbers is the reason to finish. Design: "کوییز شانس قبولی" canvas.
 */
function LivePreview({
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
  const gpa = numberOf(draft.gpa);
  const score = numberOf(draft.score);
  const picked = options.countries.filter((country) => draft.countries.includes(country.id));
  const countries = picked.map((country) => country.name);
  const complete = Math.round((done / STEPS.length) * 100);
  const completeText = t('preview.complete', { n: f.number(complete) });
  // Each answer under the step that asked it: only answered steps show.
  const rows: [Step, string, string][] = [
    ['goal', t('summary.goal'), t(`goal.${draft.goal}`)],
    ['goal', t('summary.degree'), t(`degree.${draft.degree}`)],
    [
      'background',
      t('summary.field'),
      draft.field_group ? fieldName(Number(draft.field_group)) : '—',
    ],
    [
      'background',
      t('summary.gpa'),
      Number.isFinite(gpa)
        ? t('summary.gpaOf', { gpa: f.number(gpa), scale: f.number(Number(draft.gpaScale)) })
        : '—',
    ],
    [
      'english',
      t('summary.english'),
      draft.english === 'score'
        ? Number.isFinite(score)
          ? `${t(`exam.${draft.exam}`)} ${f.number(score)}`
          : t(`exam.${draft.exam}`)
        : t(`english.${draft.english}`),
    ],
    [
      'plan',
      t('summary.countries'),
      countries.length ? f.list(countries) : t('summary.allCountries'),
    ],
    ['plan', t('summary.budget'), t(`budget.${draft.budget}`)],
  ];
  const answered = rows.filter(([key]) => STEPS.indexOf(key) < done);

  return (
    <section
      aria-labelledby="estimate-summary"
      className="m-2.5 flex flex-col gap-5 rounded-2xl px-5 py-6 text-on-hero shadow-luxe bg-luxe lg:w-90 lg:flex-none lg:px-7 lg:py-8"
    >
      <div className="flex items-center gap-4">
        <span className="relative flex-none">
          <ProgressRing value={complete} label={completeText} size={66} tone="luxe" />
          <span
            aria-hidden="true"
            className="absolute inset-0 flex items-center justify-center font-display text-sm font-bold text-luxe-gold-light"
          >
            {t('result.percent', { n: f.number(complete) })}
          </span>
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 id="estimate-summary" className="m-0 font-display text-[17px] font-semibold">
            {t('preview.lockedTitle')}
          </h2>
          <span aria-hidden="true" className="text-[13px] text-on-luxe-2">
            {done === 0 ? t('preview.short', { n: f.number(STEPS.length) }) : completeText}
          </span>
        </div>
      </div>
      <ul className="m-0 flex list-none flex-col gap-3 rounded-[14px] bg-hero-raised p-4 shadow-[inset_0_0_0_1px_var(--hero-line)]">
        {(picked.length ? picked : options.countries).slice(0, VEILED.length).map((country, at) => (
          <li
            key={country.id}
            className="flex items-center justify-between gap-3 text-sm font-semibold"
          >
            <span className="truncate">{country.name}</span>
            <span aria-hidden="true" className="inline-flex items-center gap-2">
              <span className="font-display font-bold text-luxe-gold-light blur-[5px] select-none">
                {t('result.percent', { n: f.number(VEILED[at] ?? 0) })}
              </span>
              <Icon name="lock" size={14} className="text-luxe-gold" />
            </span>
          </li>
        ))}
      </ul>
      <div className="flex flex-col gap-3">
        <h3 className="m-0 text-[13px] font-bold text-luxe-gold-light">
          {t(done === STEPS.length - 1 ? 'preview.askLast' : 'preview.ask')}
        </h3>
        <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
          {TEASES.slice(done, done + 3).map((key) => (
            <li key={key} className="flex items-start gap-2.5 text-sm leading-7">
              <span
                aria-hidden="true"
                className="mt-0.5 flex size-[22px] flex-none items-center justify-center rounded-full bg-luxe-gold text-[13px] font-extrabold"
              >
                {t('preview.mark')}
              </span>
              {t(`preview.tease.${key}`)}
            </li>
          ))}
        </ul>
      </div>
      {answered.length > 0 && (
        <section
          aria-labelledby="estimate-answers"
          className="mt-auto flex flex-col gap-3 pt-4 shadow-[inset_0_1px_0_var(--hero-line)]"
        >
          <h3 id="estimate-answers" className="m-0 text-[13px] font-normal text-on-luxe-2">
            {t('preview.answers')}
          </h3>
          <dl className="m-0 flex flex-col gap-2.5">
            {answered.map(([, label, value]) => (
              <div key={label} className="flex justify-between gap-3 text-sm">
                <dt className="text-on-luxe-2">{label}</dt>
                <dd className="m-0 text-end font-bold">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="m-0 text-xs leading-6 text-on-luxe-2">{t('summary.note')}</p>
        </section>
      )}
    </section>
  );
}
