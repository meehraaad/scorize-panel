import { useState, type ReactNode, type Ref } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/ui/Icon';
import { useFormat } from '@/lib/i18n/useFormat';
import { toast } from '@/lib/toast';
import {
  CHOICES,
  UnknownNameError,
  infoQuery,
  useSaveInfo,
  type CustomerInfo,
  type InfoSection,
} from '../api';

/** What the popup asks for when it is missing, most useful first. */
const ASKS = ['wanted_degree', 'countries', 'education', 'gpa', 'language', 'budget'] as const;
type Ask = (typeof ASKS)[number];
/** On the call strip, at most this many are offered; the session log's block offers them all. */
const STRIP_ASKS = 4;
/** One tap each; anything else is typed on the customer's info page. */
const COUNTRY_OPTIONS = ['canada', 'germany', 'usa', 'italy'] as const;

/**
 * What we know about the customer as chips, and what is missing as dashed "+ ..." chips. A dashed
 * chip opens one short question: a few answers to tap (countries: any number of them), or a
 * one-line row for a degree, a GPA or a language certificate. It saves to the customer's shared info
 * (the info page's own sections), for the whole team.
 *
 * `mode`: `strip` (the call strip) both together, up to four questions; `known` only what is known,
 * with "n missing" (`onMissing`: the session log scrolls to its block); `gaps` the session log's
 * block of every missing answer, with what was filled in meanwhile.
 */
export function ProfileChips({
  customer,
  dark = true,
  mode = 'strip',
  onMissing,
  ref,
}: {
  customer: number;
  dark?: boolean;
  mode?: 'strip' | 'known' | 'gaps';
  onMissing?: () => void;
  ref?: Ref<HTMLDivElement>;
}) {
  const { t } = useTranslation('sales');
  const { t: tc } = useTranslation('common');
  const f = useFormat();
  const { data: info } = useQuery(infoQuery(customer));
  const save = useSaveInfo(customer);
  const [asking, setAsking] = useState<Ask | null>(null);
  /** Answered here while the window is open (the gaps block lists them as done). */
  const [answered, setAnswered] = useState<Ask[]>([]);
  if (!info) return null;
  const goal = info.goal;
  const degree = (code: string) => tc(`degree.${Number(code) as (typeof CHOICES.degree)[number]}`);
  const study = info.education.at(-1);
  const exam = info.exams[0];
  const examName = exam && info.exams_list.find((item) => item.value === exam.exam)?.label;
  const known = [
    goal.wanted_degree && t('callProfile.wants', { degree: degree(goal.wanted_degree) }),
    goal.countries,
    study &&
      [
        study.degree && degree(study.degree),
        study.field,
        study.gpa && t('callProfile.gpa', { gpa: study.gpa }),
      ]
        .filter(Boolean)
        .join(' · '),
    examName ? [examName, exam.score].filter(Boolean).join(' ') : goal.language,
    goal.budget &&
      t(`callProfile.budget.${Number(goal.budget) as (typeof CHOICES.budget)[number]}`),
  ].filter((fact): fact is string => !!fact);
  const missing: Record<Ask, boolean> = {
    wanted_degree: !goal.wanted_degree,
    countries: !goal.countries,
    education: !info.education.length,
    // A degree saved without its GPA: asked on its own (the degree row asks for it too).
    gpa: !!study && !study.gpa,
    language: !info.exams.length && !goal.language,
    budget: !goal.budget,
  };
  const open = ASKS.filter((key) => missing[key]);
  const asks = mode === 'strip' ? open.slice(0, STRIP_ASKS) : open;

  const store = (key: Ask, section: InfoSection) =>
    save.mutate(section, {
      onSuccess: () => {
        setAnswered((done) => [...done, key]);
        // The gaps block goes on to the next question.
        setAsking(mode === 'gaps' ? (open.find((other) => other !== key) ?? null) : null);
        toast.success(t('callProfile.saved'));
      },
      onError: (error) =>
        toast.error(
          error instanceof UnknownNameError
            ? t('info.notFound', { value: error.value })
            : t('error'),
        ),
    });
  const setGoal = (key: Ask & keyof CustomerInfo['goal'], value: string) =>
    store(key, { goal: { ...goal, [key]: value } });

  const tone = dark ? 'bg-hero-raised text-on-hero' : 'bg-surface text-text';
  const dashed = dark
    ? 'text-hero-accent shadow-[inset_0_0_0_1px_var(--hero-line)] hover:bg-hero-raised'
    : 'text-primary-text shadow-[inset_0_0_0_1px_var(--line-3)] hover:bg-surface';
  const option = dark ? 'bg-hero text-on-hero hover:bg-hero-line' : 'bg-canvas hover:bg-tint';
  const picked = dark ? 'bg-hero-accent text-hero' : 'bg-hero text-on-hero';
  const props = { option, picked, pending: save.isPending };

  const knownList = known.length > 0 && (
    <ul aria-label={t('callProfile.title')} className="m-0 contents list-none p-0">
      {known.map((item) => (
        <li key={item} className={`max-w-full truncate rounded-full px-2.5 py-1.5 ${tone}`}>
          {item}
        </li>
      ))}
    </ul>
  );
  const askChips = asks.map((key) => (
    <button
      key={key}
      type="button"
      aria-expanded={asking === key}
      onClick={() => setAsking(asking === key ? null : key)}
      className={`min-h-8 rounded-full px-2.5 font-semibold ${asking === key ? picked : dashed} ${mode === 'gaps' ? 'min-h-11 px-3.5 text-sm' : ''}`}
    >
      {t('callProfile.ask', { what: t(`callProfile.field.${key}`) })}
    </button>
  ));
  const question = asking && missing[asking] && (
    <div className={`rounded-xl p-2 ${dark ? 'bg-hero-raised' : 'bg-surface'}`}>
      {asking === 'countries' ? (
        <CountriesAsk {...props} onSave={(names) => setGoal('countries', names.join('، '))} />
      ) : asking === 'education' ? (
        <EducationAsk
          {...props}
          dark={dark}
          onSave={(entry) =>
            store('education', { education: [...info.education, { university: '', ...entry }] })
          }
        />
      ) : asking === 'gpa' ? (
        <GpaAsk
          {...props}
          dark={dark}
          onSave={(gpa) =>
            store('gpa', {
              education: info.education.map((row, index) =>
                index === info.education.length - 1 ? { ...row, gpa } : row,
              ),
            })
          }
        />
      ) : asking === 'language' ? (
        <LanguageAsk
          {...props}
          dark={dark}
          exams={info.exams_list}
          onNone={() => setGoal('language', t('callProfile.noCertificate'))}
          onSave={(entry) => store('language', { exams: [...info.exams, { date: '', ...entry }] })}
        />
      ) : (
        <Taps
          {...props}
          legend={t(`callProfile.question.${asking}`)}
          options={(asking === 'wanted_degree' ? CHOICES.degree : CHOICES.budget).map((code) => ({
            value: String(code),
            label:
              asking === 'wanted_degree'
                ? degree(String(code))
                : t(`callProfile.budget.${code as (typeof CHOICES.budget)[number]}`),
          }))}
          onPick={(value) => setGoal(asking, value)}
        />
      )}
    </div>
  );

  if (mode === 'gaps') {
    const done = answered.filter((key) => !missing[key]);
    if (!open.length && !done.length) return null;
    return (
      <div
        ref={ref}
        className="flex flex-col gap-3 rounded-card-sm bg-row-highlight p-4 shadow-[inset_0_0_0_1px_var(--hair)]"
      >
        <div className="flex items-start gap-2.5">
          <Icon name="user" size={18} className="mt-0.5 flex-none text-primary-text" />
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-sm font-bold">
              {t(open.length ? 'callProfile.gaps.title' : 'callProfile.gaps.done')}
            </span>
            {open.length > 0 && (
              <span className="text-xs leading-5 text-text-2">{t('callProfile.gaps.hint')}</span>
            )}
          </div>
        </div>
        {done.length > 0 && (
          <ul
            aria-label={t('callProfile.gaps.answered')}
            className="m-0 flex list-none flex-wrap gap-1.5 p-0"
          >
            {done.map((key) => (
              <li
                key={key}
                className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-good-tint px-3 text-[13px] font-semibold text-good"
              >
                <Icon name="check" size={14} />
                {t(`callProfile.field.${key}`)}
              </li>
            ))}
          </ul>
        )}
        {open.length > 0 && <div className="flex flex-wrap gap-2">{askChips}</div>}
        {question}
      </div>
    );
  }

  if (!known.length && !(mode === 'known' ? open.length && onMissing : asks.length)) return null;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5 text-xs">
        {knownList}
        {mode === 'strip' && askChips}
        {mode === 'known' && open.length > 0 && onMissing && (
          <button
            type="button"
            onClick={onMissing}
            className={`min-h-8 rounded-full px-2.5 font-semibold ${dashed}`}
          >
            {t('callProfile.missing', { count: open.length, n: f.number(open.length) })}
          </button>
        )}
      </div>
      {mode === 'strip' && question}
    </div>
  );
}

interface AskProps {
  option: string;
  picked: string;
  pending: boolean;
}

function Row({ legend, children }: { legend: string; children: ReactNode }) {
  return (
    <fieldset className="m-0 flex min-w-0 flex-wrap items-center gap-1.5 border-0 p-0">
      <legend className="sr-only">{legend}</legend>
      <span aria-hidden="true" className="px-1.5 text-xs font-semibold">
        {legend}
      </span>
      {children}
    </fieldset>
  );
}

const tap = 'min-h-9 rounded-full px-3 text-xs disabled:opacity-50';

function Taps({
  legend,
  options,
  onPick,
  option,
  pending,
}: AskProps & {
  legend: string;
  options: { value: string; label: string }[];
  onPick: (value: string) => void;
}) {
  return (
    <Row legend={legend}>
      {options.map((item) => (
        <button
          key={item.value}
          type="button"
          disabled={pending}
          onClick={() => onPick(item.value)}
          className={`${tap} ${option}`}
        >
          {item.label}
        </button>
      ))}
    </Row>
  );
}

function SaveButton({ disabled, onClick }: { disabled: boolean; onClick: () => void }) {
  const { t } = useTranslation('sales');
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`${tap} bg-primary font-semibold text-on-primary`}
    >
      {t('callProfile.save')}
    </button>
  );
}

/** Any number of countries; saved together. */
function CountriesAsk({
  option,
  picked,
  pending,
  onSave,
}: AskProps & { onSave: (names: string[]) => void }) {
  const { t } = useTranslation('sales');
  const [chosen, setChosen] = useState<string[]>([]);
  const toggle = (name: string) =>
    setChosen(chosen.includes(name) ? chosen.filter((item) => item !== name) : [...chosen, name]);
  return (
    <Row legend={t('callProfile.question.countries')}>
      {COUNTRY_OPTIONS.map((code) => {
        const name = t(`callProfile.country.${code}`);
        const on = chosen.includes(name);
        return (
          <button
            key={code}
            type="button"
            aria-pressed={on}
            onClick={() => toggle(name)}
            className={`${tap} ${on ? picked : option}`}
          >
            {name}
          </button>
        );
      })}
      <SaveButton disabled={pending || !chosen.length} onClick={() => onSave(chosen)} />
    </Row>
  );
}

const field = (dark: boolean) =>
  `h-9 min-w-0 rounded-full border-0 px-3 text-xs outline-none focus-visible:outline-2 focus-visible:outline-focus ${dark ? 'bg-hero text-on-hero placeholder:text-on-hero-2' : 'bg-canvas text-text placeholder:text-text-3'}`;

/** The last degree: which, the field, the GPA, in one row. */
function EducationAsk({
  option,
  picked,
  pending,
  dark,
  onSave,
}: AskProps & {
  dark: boolean;
  onSave: (entry: { degree: string; field: string; gpa: string }) => void;
}) {
  const { t } = useTranslation('sales');
  const { t: tc } = useTranslation('common');
  const [degree, setDegree] = useState('');
  const [study, setStudy] = useState('');
  const [gpa, setGpa] = useState('');
  return (
    <div className="flex flex-col gap-2">
      <Row legend={t('callProfile.question.education')}>
        {CHOICES.degree.map((code) => (
          <button
            key={code}
            type="button"
            aria-pressed={degree === String(code)}
            onClick={() => setDegree(String(code))}
            className={`${tap} ${degree === String(code) ? picked : option}`}
          >
            {tc(`degree.${code}`)}
          </button>
        ))}
      </Row>
      <div className="flex flex-wrap items-center gap-1.5">
        <input
          aria-label={t('callProfile.studyField')}
          placeholder={t('callProfile.studyField')}
          value={study}
          onChange={(event) => setStudy(event.target.value)}
          className={`${field(dark)} flex-1`}
        />
        <input
          aria-label={t('callProfile.gpaLabel')}
          placeholder={t('callProfile.gpaLabel')}
          inputMode="decimal"
          value={gpa}
          onChange={(event) => setGpa(event.target.value)}
          className={`${field(dark)} w-20`}
        />
        <SaveButton
          disabled={pending || !degree}
          onClick={() => onSave({ degree, field: study.trim(), gpa: gpa.trim() })}
        />
      </div>
    </div>
  );
}

/** The GPA of the last degree, when the degree was saved without one. */
function GpaAsk({
  pending,
  dark,
  onSave,
}: AskProps & { dark: boolean; onSave: (gpa: string) => void }) {
  const { t } = useTranslation('sales');
  const [gpa, setGpa] = useState('');
  return (
    <Row legend={t('callProfile.question.gpa')}>
      <input
        aria-label={t('callProfile.gpaLabel')}
        placeholder={t('callProfile.gpaLabel')}
        inputMode="decimal"
        value={gpa}
        onChange={(event) => setGpa(event.target.value)}
        className={`${field(dark)} w-24`}
      />
      <SaveButton disabled={pending || !gpa.trim()} onClick={() => onSave(gpa.trim())} />
    </Row>
  );
}

/** A language certificate (exam and score), or "no certificate". */
function LanguageAsk({
  option,
  picked,
  pending,
  dark,
  exams,
  onNone,
  onSave,
}: AskProps & {
  dark: boolean;
  exams: { value: string; label: string }[];
  onNone: () => void;
  onSave: (entry: { exam: string; score: string }) => void;
}) {
  const { t } = useTranslation('sales');
  const [exam, setExam] = useState('');
  const [score, setScore] = useState('');
  return (
    <div className="flex flex-col gap-2">
      <Row legend={t('callProfile.question.language')}>
        {exams.slice(0, 5).map((item) => (
          <button
            key={item.value}
            type="button"
            aria-pressed={exam === item.value}
            onClick={() => setExam(item.value)}
            className={`${tap} ${exam === item.value ? picked : option}`}
          >
            {item.label}
          </button>
        ))}
        <button type="button" disabled={pending} onClick={onNone} className={`${tap} ${option}`}>
          {t('callProfile.noCertificate')}
        </button>
      </Row>
      {exam && (
        <div className="flex flex-wrap items-center gap-1.5">
          <input
            aria-label={t('callProfile.score')}
            placeholder={t('callProfile.score')}
            inputMode="decimal"
            value={score}
            onChange={(event) => setScore(event.target.value)}
            className={`${field(dark)} w-24`}
          />
          <SaveButton disabled={pending} onClick={() => onSave({ exam, score: score.trim() })} />
        </div>
      )}
    </div>
  );
}
