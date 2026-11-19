import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Chip, type ChipTone } from '@/components/ui/Chip';
import { ChoiceGroup } from '@/components/ui/Choices';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import { NumberStepper } from '@/components/ui/NumberStepper';
import { PageStack } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import { ProgressBar } from '@/components/ui/Progress';
import {
  checkPathways,
  finderOptionsQuery,
  type Answers,
  type FinderContact,
  type FinderPathway,
  type PathwayResult,
} from '@/lib/applicant/pathways';
import { useFormat } from '@/lib/i18n/useFormat';
import { toLatinDigits } from '@/lib/text';
import { toast } from '@/lib/toast';
import {
  answeredPathways,
  asksLeft,
  countriesLeft,
  countryProgress,
  mergeAnswers,
  nextAsk,
  type Ask,
  type Goal,
} from './plan';
import type { ParseKeys } from 'i18next';

/** A key built at run time (a question's, a status's): one of this dictionary's. */
const key = (name: string) => name as ParseKeys<'pathways'>;

type Stage = 'intro' | 'ask' | 'first' | 'results';
const GOALS: readonly Goal[] = ['work', 'study', 'any'];
/** How long a picked answer stays shown before the next question comes in. */
const PICK_DELAY = 280;

/**
 * The pathway finder (any account), one calm question per screen. The person says what they want,
 * then answers: first the fewest questions that answer one route fully. When that route is ready
 * it opens quietly beside the questions (it never takes over the screen), and the person can look
 * at it or keep going for more countries. We say which routes fit; they never pick one.
 */
export default function FinderPage() {
  const { t } = useTranslation('pathways');
  const { data: options } = useSuspenseQuery(finderOptionsQuery);
  const [stage, setStage] = useState<Stage>('intro');
  const [goal, setGoal] = useState<Goal | null>(null);
  // Answers by question id, in the order given (Back takes the last one off).
  const [parts, setParts] = useState<{ id: string; set: Answers }[]>([]);
  const [results, setResults] = useState<PathwayResult[]>([]);
  // The route answered first: shown beside the questions once it is ready.
  const [firstId, setFirstId] = useState<number | null>(null);

  const answered = useMemo(() => new Set(parts.map((part) => part.id)), [parts]);
  const answers = useMemo(
    () => mergeAnswers(Object.fromEntries(parts.map((part) => [part.id, part.set]))),
    [parts],
  );
  const pathways = options.pathways;
  const ask = goal ? nextAsk(pathways, goal, answered) : null;

  const check = useMutation({
    mutationFn: ({ given, contact }: { given: Answers; contact: FinderContact }) =>
      checkPathways(given, contact),
  });
  // The first route's verdict, fetched in the background while the questions go on.
  const peek = useMutation({
    mutationFn: (given: Answers) => checkPathways(given, { channel: 'none' }),
  });

  /** What the routes say for these answers, then on to `next`. */
  const evaluate = (given: Answers, next: Stage) =>
    check.mutate(
      { given, contact: { channel: 'none' } },
      {
        onSuccess: (data) => {
          setResults(data.results);
          setStage(next);
        },
        onError: () => toast.error(t('error')),
      },
    );

  const afterAnswer = (nextParts: { id: string; set: Answers }[]) => {
    setParts(nextParts);
    if (!goal) return;
    const done = new Set(nextParts.map((part) => part.id));
    const given = mergeAnswers(Object.fromEntries(nextParts.map((part) => [part.id, part.set])));
    if (nextAsk(pathways, goal, done) === null) {
      evaluate(given, 'results');
      return;
    }
    const ready = answeredPathways(pathways, goal, done)[0];
    if (firstId === null && ready) {
      setFirstId(ready.id);
      peek.mutate(given, { onSuccess: (data) => setResults(data.results) });
    }
  };

  const restart = () => {
    setParts([]);
    setGoal(null);
    setFirstId(null);
    setResults([]);
    setStage('intro');
  };

  if (!pathways.length)
    return (
      <PageStack>
        <PageHeader title={t('title')} />
        <EmptyState title={t('empty.title')} variant="card">
          {t('empty.body')}
        </EmptyState>
      </PageStack>
    );

  const firstPathway = pathways.find((p) => p.id === firstId);
  // Back past its last question hides the first route again.
  const firstReady =
    goal !== null &&
    firstPathway !== undefined &&
    answeredPathways(pathways, goal, answered).some((p) => p.id === firstPathway.id);
  const firstResult = results.find((r) => r.pathway.id === firstId);

  if (stage === 'results' && goal)
    return (
      <Results
        results={results.filter((r) =>
          answeredPathways(pathways, goal, answered).some((p) => p.id === r.pathway.id),
        )}
        canAskMore={nextAsk(pathways, goal, answered) !== null}
        onMore={() => setStage('ask')}
        onEdit={restart}
        consulting={check.isPending}
        onConsult={() =>
          check.mutate(
            { given: answers, contact: { channel: 'call', time: 'now' } },
            {
              onSuccess: () => toast.success(t('consult.sent')),
              onError: () => toast.error(t('error')),
            },
          )
        }
      />
    );

  if (stage === 'intro')
    return (
      <QuizPanel>
        <Intro pathways={pathways} onStart={() => setStage('ask')} />
      </QuizPanel>
    );

  if (stage === 'first' && goal)
    return (
      <QuizPanel>
        <FirstResult
          result={firstResult}
          countries={countriesLeft(pathways, goal, answered)}
          busy={check.isPending}
          onMore={() => setStage('ask')}
          onEnough={() => evaluate(answers, 'results')}
        />
      </QuizPanel>
    );

  // The questions: the goal first, then what the routes need.
  const total = 1 + parts.length + asksLeft(pathways, goal ?? 'any', answered);
  const number = goal ? parts.length + 2 : 1;
  return (
    <QuizPanel
      step={{ number, total }}
      rail={
        goal ? (
          <Rail
            countries={countryProgress(pathways, goal, answered)}
            peek={
              firstReady ? (
                <Peek pathway={firstPathway} result={firstResult} onSee={() => setStage('first')} />
              ) : null
            }
          />
        ) : null
      }
    >
      {!goal ? (
        <Question key="goal" title={t('goal.title')} help={t('goal.help')} number={number}>
          <OptionsAnswer
            legend={t('goal.title')}
            options={GOALS.map((value) => ({
              value,
              label: t(key(`goal.${value}`)),
              hint: t(key(`goal.${value}_hint`)),
            }))}
            busy={check.isPending}
            onPick={(value) => {
              setGoal(value);
              if (!nextAsk(pathways, value, answered)) evaluate(answers, 'results');
            }}
          />
          <Actions onBack={() => setStage('intro')} hint={t('keys_hint')} />
        </Question>
      ) : (
        ask && (
          <Question
            key={ask.id}
            title={t(key(`asks.${ask.id}.title`))}
            help={t(key(`asks.${ask.id}.help`))}
            number={number}
          >
            <AskAnswer
              ask={ask}
              busy={check.isPending}
              onBack={() => (parts.length ? setParts(parts.slice(0, -1)) : setGoal(null))}
              onAnswer={(set) => afterAnswer([...parts, { id: ask.id, set }])}
              onShowResults={firstReady ? () => evaluate(answers, 'results') : undefined}
            />
          </Question>
        )
      )}
    </QuizPanel>
  );
}

/** The quiz's white stage: the progress on top, the question, and the countries beside it. */
function QuizPanel({
  step,
  rail,
  children,
}: {
  step?: { number: number; total: number } | undefined;
  rail?: ReactNode;
  children: ReactNode;
}) {
  const { t } = useTranslation('pathways');
  const f = useFormat();
  return (
    <section className="overflow-hidden rounded-3xl bg-surface shadow-panel">
      {step && (
        <div className="flex items-center gap-4 px-6 pt-6 lg:px-14 lg:pt-8">
          <ProgressBar
            size="sm"
            value={Math.round(((step.number - 1) / step.total) * 100)}
            label={t('progress')}
            className="flex-1"
          />
          <span className="text-sm text-text-2 tabular-nums">
            {t('step', { number: f.number(step.number), total: f.number(step.total) })}
          </span>
        </div>
      )}
      <div
        className={`grid gap-8 px-6 py-8 lg:gap-10 lg:px-14 lg:py-10 ${
          rail ? 'lg:grid-cols-[minmax(0,1fr)_17rem]' : ''
        }`}
      >
        <div className="max-w-3xl min-w-0">{children}</div>
        {rail && <aside className="min-w-0 max-lg:order-first">{rail}</aside>}
      </div>
    </section>
  );
}

function Intro({ pathways, onStart }: { pathways: FinderPathway[]; onStart: () => void }) {
  const { t } = useTranslation('pathways');
  const f = useFormat();
  const countries = [...new Map(pathways.map((p) => [p.country.id, p.country.name])).values()];
  const fact = 'm-0 text-xl leading-8 font-bold text-text';
  return (
    <div className="flex animate-rise flex-col gap-4">
      <p className="m-0 text-[15px] font-semibold text-primary-text">{t('intro.eyebrow')}</p>
      <h1 className="m-0 text-5xl leading-tight font-extrabold tracking-tight text-balance">
        {t('intro.title')}
      </h1>
      <p className="m-0 max-w-xl text-lg leading-8 text-text-2 lg:text-xl">{t('intro.body')}</p>
      <dl className="m-0 flex flex-wrap gap-x-10 gap-y-4 pt-6 pb-6 text-sm text-text-2">
        <div className="flex flex-col-reverse">
          <dt>{t('intro.time_label')}</dt>
          <dd className={fact}>{t('intro.time')}</dd>
        </div>
        <div className="flex flex-col-reverse">
          <dt>{f.list(countries)}</dt>
          <dd className={fact}>
            {t('intro.countries', { count: countries.length, n: f.number(countries.length) })}
          </dd>
        </div>
        <div className="flex flex-col-reverse">
          <dt>{t('intro.free_label')}</dt>
          <dd className={fact}>{t('intro.free')}</dd>
        </div>
      </dl>
      <div>
        <Button size="lg" className="px-8" onClick={onStart} autoFocus>
          {t('intro.start')}
        </Button>
      </div>
    </div>
  );
}

/** One question: its number, the question in large type, a line of help, then the answer. */
function Question({
  title,
  help,
  number,
  children,
}: {
  title: string;
  help: string;
  number: number;
  children: ReactNode;
}) {
  const { t } = useTranslation('pathways');
  const f = useFormat();
  return (
    <div className="flex animate-rise flex-col">
      <p className="m-0 text-[15px] font-semibold text-primary-text">
        {t('question', { number: f.number(number) })}
      </p>
      <h1 className="m-0 mt-3 text-3xl leading-snug font-extrabold tracking-tight text-balance lg:text-4xl lg:leading-tight">
        {title}
      </h1>
      <p className="m-0 mt-3 max-w-xl text-base leading-8 text-text-2 lg:text-lg">{help}</p>
      <div className="flex flex-col gap-10 pt-8">{children}</div>
    </div>
  );
}

function Actions({
  onBack,
  busy = false,
  hint,
  children,
}: {
  onBack: () => void;
  busy?: boolean;
  hint?: string;
  children?: ReactNode;
}) {
  const { t } = useTranslation('pathways');
  return (
    <div className="flex flex-wrap items-center gap-3">
      {children}
      <Button variant="outline" size="lg" onClick={onBack} disabled={busy}>
        {t('back')}
      </Button>
      {hint && <span className="text-sm text-text-2 max-lg:hidden">{hint}</span>}
    </div>
  );
}

/** Large answers; a click or the option's number on the keyboard picks it and moves on. */
function OptionsAnswer<T extends string>({
  legend,
  options,
  busy,
  onPick,
}: {
  legend: string;
  options: { value: T; label: string; hint?: string }[];
  busy: boolean;
  onPick: (value: T) => void;
}) {
  const f = useFormat();
  const [picked, setPicked] = useState<T | null>(null);
  const pickRef = useRef(onPick);
  useEffect(() => {
    pickRef.current = onPick;
  });
  useEffect(() => {
    if (picked === null) return;
    const timer = setTimeout(() => pickRef.current(picked), PICK_DELAY);
    return () => clearTimeout(timer);
  }, [picked]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.metaKey || event.ctrlKey || event.altKey || target?.closest('input,textarea'))
        return;
      const option = options[Number(toLatinDigits(event.key)) - 1];
      if (option && !busy && picked === null) setPicked(option.value);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [options, busy, picked]);
  return (
    <ChoiceGroup
      legend={legend}
      hideLegend
      look="answers"
      options={options.map((option, index) => ({
        ...option,
        extra: (
          <span
            aria-hidden="true"
            className="flex size-7 flex-none items-center justify-center rounded-lg bg-surface text-[13px] text-text-2 shadow-[inset_0_0_0_1px_var(--line-2)] max-lg:hidden"
          >
            {f.number(index + 1)}
          </span>
        ),
      }))}
      value={picked}
      onChange={(value) => {
        if (!busy && picked === null) setPicked(value);
      }}
    />
  );
}

function AskAnswer({
  ask,
  busy,
  onBack,
  onAnswer,
  onShowResults,
}: {
  ask: Ask;
  busy: boolean;
  onBack: () => void;
  onAnswer: (set: Answers) => void;
  /** Once a first route is ready: stop here and see the routes so far. */
  onShowResults?: (() => void) | undefined;
}) {
  const { t } = useTranslation('pathways');
  const f = useFormat();
  const formId = useId();
  const min = ask.min ?? 0;
  const max = ask.max ?? 100;
  const [value, setValue] = useState(ask.start ?? min);
  const early = onShowResults && (
    <Button
      variant="outline"
      size="lg"
      className="text-primary-text"
      onClick={onShowResults}
      disabled={busy}
    >
      {t('results.show')}
    </Button>
  );
  if (ask.input === 'options')
    return (
      <>
        <OptionsAnswer
          legend={t(key(`asks.${ask.id}.title`))}
          options={(ask.options ?? []).map((option) => ({
            value: option.id,
            label: t(key(`asks.${ask.id}.options.${option.id}`)),
          }))}
          busy={busy}
          onPick={(id) => {
            const option = ask.options?.find((candidate) => candidate.id === id);
            if (option) onAnswer(option.set);
          }}
        />
        <Actions onBack={onBack} busy={busy} hint={t('keys_hint')}>
          {early}
        </Actions>
      </>
    );
  const label = t(key(`asks.${ask.id}.label`));
  return (
    <>
      <form
        id={formId}
        className="flex max-w-md flex-col gap-6"
        onSubmit={(event) => {
          event.preventDefault();
          if (!busy) onAnswer({ [ask.factors[0] ?? ask.id]: value });
        }}
      >
        <NumberStepper
          look="hero"
          label={label}
          value={value}
          onChange={setValue}
          min={min}
          max={max}
          decreaseLabel={t('less')}
          increaseLabel={t('more')}
        />
        <div className="flex flex-col gap-2">
          <input
            type="range"
            aria-label={label}
            min={min}
            max={max}
            value={value}
            onChange={(event) => setValue(Number(event.target.value))}
            className="h-11 w-full cursor-pointer accent-primary"
          />
          <div
            aria-hidden="true"
            className="flex justify-between text-[13px] text-text-2 tabular-nums"
          >
            <span>{f.number(min)}</span>
            <span>{f.number(max)}</span>
          </div>
        </div>
      </form>
      <Actions onBack={onBack} busy={busy} hint={t('number_hint')}>
        <Button type="submit" form={formId} size="lg" className="px-8" disabled={busy}>
          {t('next')}
        </Button>
        {early}
      </Actions>
    </>
  );
}

/** A country's ring: how much of its closest route is answered; a tick once it is. */
function Ring({ total, left }: { total: number; left: number }) {
  if (left === 0)
    return (
      <span
        aria-hidden="true"
        className="flex size-8 flex-none items-center justify-center rounded-full bg-good text-surface lg:size-10"
      >
        <Icon name="check" size={16} />
      </span>
    );
  const share = total ? ((total - left) / total) * 100 : 0;
  return (
    <span
      aria-hidden="true"
      className="size-8 flex-none rounded-full p-1 lg:size-10"
      style={{ background: `conic-gradient(var(--primary) ${String(share)}%, var(--track) 0)` }}
    >
      <span className="block size-full rounded-full bg-canvas" />
    </span>
  );
}

/** The countries being checked as the person answers (beside the question; chips on phones). */
function Rail({
  countries,
  peek,
}: {
  countries: { id: number; name: string; total: number; left: number }[];
  peek: ReactNode;
}) {
  const { t } = useTranslation('pathways');
  const f = useFormat();
  return (
    <div className="flex flex-col">
      <h2 className="m-0 mb-2 text-[13px] font-semibold text-text-2 max-lg:sr-only">
        {t('rail.title')}
      </h2>
      <ul className="m-0 flex list-none gap-2 overflow-x-auto p-0 lg:flex-col">
        {countries.map((country) => {
          const done = country.left === 0;
          return (
            <li
              key={country.id}
              className="flex flex-none items-center gap-2.5 rounded-full bg-canvas py-1.5 ps-1.5 pe-4 lg:gap-3.5 lg:py-3.5"
            >
              <Ring total={country.total} left={country.left} />
              <span className="flex flex-col">
                <span className="text-sm leading-5 font-semibold lg:text-base">{country.name}</span>
                <span
                  className={`text-xs leading-5 lg:text-sm ${done ? 'text-good' : 'text-text-2'}`}
                >
                  {done
                    ? t('rail.done')
                    : country.left === country.total
                      ? t('rail.waiting')
                      : t('rail.left', { count: country.left, n: f.number(country.left) })}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
      {peek}
      <p className="m-0 mt-4 text-[13px] leading-6 text-text-2 max-lg:hidden">{t('rail.note')}</p>
    </div>
  );
}

/** The first route, ready: a quiet note that opens beside the questions without stopping them. */
function Peek({
  pathway,
  result,
  onSee,
}: {
  pathway: FinderPathway | undefined;
  result: PathwayResult | undefined;
  onSee: () => void;
}) {
  const { t } = useTranslation('pathways');
  if (!pathway) return null;
  return (
    <div
      role="status"
      style={{ animationDelay: '0.5s' }}
      className="mt-4 flex animate-rise flex-col gap-0.5 rounded-2xl bg-good-tint px-4 py-3.5"
    >
      <span className="flex items-center gap-2 text-[13px] font-semibold text-good">
        <span aria-hidden="true" className="size-2 rounded-full bg-good" />
        {t('peek.title')}
      </span>
      <span className="mt-1 text-base leading-7 font-bold">
        {t('peek.route', { country: pathway.country.name, name: pathway.name })}
      </span>
      {result && <span className="text-sm text-text-2">{t(key(verdict(result).key))}</span>}
      <button
        type="button"
        onClick={onSee}
        className="min-h-11 self-start text-[15px] font-semibold text-good hover:underline"
      >
        {t('peek.see')}
      </button>
    </div>
  );
}

const verdict = (result: PathwayResult): { tone: ChipTone; key: string } =>
  result.qualifies
    ? { tone: 'good', key: 'fit.good' }
    : result.eligible
      ? { tone: 'warn', key: 'fit.close' }
      : { tone: 'neutral', key: 'fit.not_now' };

function RouteCard({ result, lead = false }: { result: PathwayResult; lead?: boolean }) {
  const { t } = useTranslation('pathways');
  const f = useFormat();
  const { pathway } = result;
  const fit = verdict(result);
  const max = Math.max(pathway.max_points, pathway.pass_mark ?? 0, result.points, 1);
  return (
    <article
      className={`flex flex-col gap-6 rounded-3xl bg-surface p-6 shadow-panel lg:p-9 ${
        lead ? 'lg:p-10' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col">
          <span className="text-sm text-text-2">{pathway.country.name}</span>
          <h2
            className={`m-0 mt-1 leading-snug font-extrabold tracking-tight text-balance ${
              lead ? 'text-[26px] lg:text-3xl' : 'text-xl lg:text-2xl'
            }`}
          >
            {pathway.name}
          </h2>
        </div>
        <Chip tone={fit.tone}>{t(key(fit.key))}</Chip>
      </div>
      {pathway.summary && <p className="m-0 text-base leading-8 lg:text-lg">{pathway.summary}</p>}
      {pathway.pass_mark !== null && (
        <div className="flex flex-col gap-2.5">
          <div className="flex justify-between gap-3 text-sm text-text-2">
            <span>{t('facts.score')}</span>
            <span className="tabular-nums">
              {t('facts.score_value', {
                points: f.number(result.points),
                pass: f.number(pathway.pass_mark),
              })}
            </span>
          </div>
          <ProgressBar
            value={Math.min(100, (result.points / max) * 100)}
            mark={(pathway.pass_mark / max) * 100}
            tone={result.qualifies ? 'good' : 'warn'}
          />
        </div>
      )}
      {(pathway.duration || pathway.cost) && (
        <dl className="m-0 grid grid-cols-2 gap-4 border-t border-hair pt-5">
          {pathway.duration && (
            <div className="flex flex-col-reverse gap-0.5">
              <dt className="text-[13px] text-text-2">{t('facts.time')}</dt>
              <dd className="m-0 text-[15px] font-semibold">{pathway.duration}</dd>
            </div>
          )}
          {pathway.cost && (
            <div className="flex flex-col-reverse gap-0.5">
              <dt className="text-[13px] text-text-2">{t('facts.cost')}</dt>
              <dd className="m-0 text-[15px] font-semibold">{t(key(`cost.${pathway.cost}`))}</dd>
            </div>
          )}
        </dl>
      )}
      {result.missing.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-sm font-semibold">{t('missing')}</span>
          <ul className="m-0 flex flex-col gap-1 ps-5 text-sm leading-7">
            {result.missing.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      )}
      {pathway.tip && (
        <div className="flex flex-col gap-1 rounded-2xl bg-canvas p-4 text-sm leading-7 lg:px-5">
          <span className="font-semibold text-primary-text">{t('tip')}</span>
          <span>{pathway.tip}</span>
        </div>
      )}
    </article>
  );
}

function FirstResult({
  result,
  countries,
  busy,
  onMore,
  onEnough,
}: {
  result: PathwayResult | undefined;
  countries: { id: number; name: string; left: number }[];
  busy: boolean;
  onMore: () => void;
  onEnough: () => void;
}) {
  const { t } = useTranslation('pathways');
  const nextCountry = countries[0];
  return (
    <div className="flex animate-rise flex-col gap-8">
      <h1 className="m-0 text-3xl leading-tight font-extrabold tracking-tight lg:text-4xl">
        {t('first.title')}
      </h1>
      {result && <RouteCard result={result} lead />}
      <div className="flex flex-wrap gap-3">
        <Button size="lg" onClick={onMore}>
          {nextCountry
            ? t('first.continue', { count: nextCountry.left, country: nextCountry.name })
            : t('first.keep')}
        </Button>
        <Button variant="outline" size="lg" onClick={onEnough} disabled={busy}>
          {t('first.enough')}
        </Button>
      </div>
    </div>
  );
}

function Results({
  results,
  canAskMore,
  onMore,
  onEdit,
  consulting,
  onConsult,
}: {
  results: PathwayResult[];
  canAskMore: boolean;
  onMore: () => void;
  onEdit: () => void;
  consulting: boolean;
  onConsult: () => void;
}) {
  const { t } = useTranslation('pathways');
  const f = useFormat();
  const fitting = results.filter((r) => r.eligible).slice(0, 3);
  const others = results.filter((r) => !fitting.includes(r));
  return (
    <div className="flex animate-rise flex-col gap-10">
      <header className="flex flex-col">
        <p className="m-0 text-[15px] font-semibold text-primary-text">{t('results.eyebrow')}</p>
        <h1 className="m-0 mt-3 text-3xl leading-tight font-extrabold tracking-tight text-balance lg:text-4xl">
          {fitting.length ? t('results.title', { count: fitting.length }) : t('results.none')}
        </h1>
        {fitting.length > 0 && (
          <p className="m-0 mt-4 max-w-2xl text-base leading-8 text-text-2 lg:text-lg">
            {t('results.intro')}
          </p>
        )}
      </header>
      {fitting.length > 0 && (
        <div className="grid items-start gap-5 lg:grid-cols-2">
          {fitting.map((result, index) => (
            <RouteCard key={result.pathway.id} result={result} lead={index === 0} />
          ))}
        </div>
      )}
      {others.length > 0 && (
        <section className="flex flex-col">
          <h2 className="m-0 mb-2 text-xl font-bold">{t('results.not_now')}</h2>
          <ul className="m-0 flex list-none flex-col p-0">
            {others.map((result) => (
              <li
                key={result.pathway.id}
                className="flex flex-col gap-1 border-b border-hair py-4 lg:flex-row lg:justify-between lg:gap-6"
              >
                <span className="text-base">
                  {t('peek.route', {
                    country: result.pathway.country.name,
                    name: result.pathway.name,
                  })}
                </span>
                <span className="text-sm text-text-2">
                  {f.list(result.missing) || t('results.points_short')}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="grid items-center gap-6 rounded-3xl bg-primary p-6 text-on-primary lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-10 lg:p-10">
        <div className="flex flex-col gap-2">
          <h2 className="m-0 text-2xl leading-snug font-bold tracking-tight lg:text-3xl">
            {t('consult.title')}
          </h2>
          <p className="m-0 text-base leading-8 opacity-90">{t('consult.body')}</p>
        </div>
        <Button
          variant="outline"
          size="lg"
          className="text-primary-text"
          onClick={onConsult}
          disabled={consulting}
        >
          {t('consult.button')}
        </Button>
      </section>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-3">
          {canAskMore && (
            <Button variant="outline" size="lg" onClick={onMore}>
              {t('results.more')}
            </Button>
          )}
          <Button variant="outline" size="lg" onClick={onEdit}>
            {t('results.edit')}
          </Button>
        </div>
        <p className="m-0 text-[13px] leading-7 text-text-2">{t('results.disclaimer')}</p>
      </div>
    </div>
  );
}
