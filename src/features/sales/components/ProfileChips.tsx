import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from '@/lib/toast';
import {
  CHOICES,
  UnknownNameError,
  infoQuery,
  useSaveInfo,
  type CustomerInfo,
  type InfoSection,
} from '../api';

/** What the popup asks for when it is missing, most useful first; at most four are offered. */
const ASKS = ['wanted_degree', 'countries', 'education', 'language', 'budget'] as const;
type Ask = (typeof ASKS)[number];
/** One tap each; anything else is typed on the customer's info page. */
const COUNTRY_OPTIONS = ['canada', 'germany', 'usa', 'italy'] as const;

/**
 * What we know about the customer, as chips on the call strip, and up to four dashed "+ ..." chips
 * for what is missing. A dashed chip opens one short question: a few answers to tap (countries: any
 * number of them), or a one-line row for a degree or a language certificate. It saves to the
 * customer's shared info (the info page's own sections), for the whole team.
 */
export function ProfileChips({ customer, dark = true }: { customer: number; dark?: boolean }) {
  const { t } = useTranslation('sales');
  const { t: tc } = useTranslation('common');
  const { data: info } = useQuery(infoQuery(customer));
  const save = useSaveInfo(customer);
  const [asking, setAsking] = useState<Ask | null>(null);
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
    language: !info.exams.length && !goal.language,
    budget: !goal.budget,
  };
  const asks = ASKS.filter((key) => missing[key]).slice(0, 4);

  const store = (section: InfoSection) =>
    save.mutate(section, {
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
    });
  const setGoal = (key: keyof CustomerInfo['goal'], value: string) =>
    store({ goal: { ...goal, [key]: value } });

  if (!known.length && !asks.length) return null;
  const tone = dark ? 'bg-hero-raised text-on-hero' : 'bg-surface text-text';
  const dashed = dark
    ? 'text-hero-accent shadow-[inset_0_0_0_1px_var(--hero-line)] hover:bg-hero-raised'
    : 'text-primary-text shadow-[inset_0_0_0_1px_var(--line-3)] hover:bg-surface';
  const option = dark ? 'bg-hero text-on-hero hover:bg-hero-line' : 'bg-canvas hover:bg-tint';
  const picked = dark ? 'bg-hero-accent text-hero' : 'bg-hero text-on-hero';
  const props = { option, picked, pending: save.isPending };
  return (
    <div className="flex flex-col gap-2">
      <ul
        aria-label={t('callProfile.title')}
        className="m-0 flex list-none flex-wrap gap-1.5 p-0 text-xs"
      >
        {known.map((item) => (
          <li key={item} className={`max-w-full truncate rounded-full px-2.5 py-1.5 ${tone}`}>
            {item}
          </li>
        ))}
        {asks.map((key) => (
          <li key={key}>
            <button
              type="button"
              aria-expanded={asking === key}
              onClick={() => setAsking(asking === key ? null : key)}
              className={`min-h-8 rounded-full px-2.5 font-semibold ${asking === key ? picked : dashed}`}
            >
              {t('callProfile.ask', { what: t(`callProfile.field.${key}`) })}
            </button>
          </li>
        ))}
      </ul>
      {asking && (
        <div className={`rounded-xl p-2 ${dark ? 'bg-hero-raised' : 'bg-surface'}`}>
          {asking === 'countries' ? (
            <CountriesAsk {...props} onSave={(names) => setGoal('countries', names.join('، '))} />
          ) : asking === 'education' ? (
            <EducationAsk
              {...props}
              dark={dark}
              onSave={(entry) =>
                store({ education: [...info.education, { university: '', ...entry }] })
              }
            />
          ) : asking === 'language' ? (
            <LanguageAsk
              {...props}
              dark={dark}
              exams={info.exams_list}
              onNone={() => setGoal('language', t('callProfile.noCertificate'))}
              onSave={(entry) => store({ exams: [...info.exams, { date: '', ...entry }] })}
            />
          ) : (
            <Taps
              {...props}
              legend={t(`callProfile.question.${asking}`)}
              options={(asking === 'wanted_degree' ? CHOICES.degree : CHOICES.budget).map(
                (code) => ({
                  value: String(code),
                  label:
                    asking === 'wanted_degree'
                      ? degree(String(code))
                      : t(`callProfile.budget.${code as (typeof CHOICES.budget)[number]}`),
                }),
              )}
              onPick={(value) => setGoal(asking, value)}
            />
          )}
        </div>
      )}
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
