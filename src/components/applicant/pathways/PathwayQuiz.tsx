import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { Logo } from '@/components/ui/Logo';
import { ProgressBar } from '@/components/ui/Progress';
import { Sheet } from '@/components/ui/Sheet';
import { buttonClass } from '@/components/ui/buttonStyles';
import {
  checkPathways,
  finderOptionsQuery,
  type Answers,
  type CountryAnswers,
  type FinderBudget,
  type FinderContact,
  type FinderIncome,
  type FinderOptions,
  type FinderPathway,
  type PathwayResult,
} from '@/lib/applicant/pathways';
import { useFormat } from '@/lib/i18n/useFormat';
import { SITE } from '@/lib/site';
import { useKeyboardInset } from '@/lib/useKeyboardInset';
import { DESKTOP_QUERY, useMediaQuery } from '@/lib/useMediaQuery';
import { toast } from '@/lib/toast';
import {
  answeredPathways,
  asksLeft,
  BUDGET,
  FIELD_OCCUPATION,
  OCCUPATION,
  INCOME_AMOUNT,
  INCOME_CURRENCIES,
  INCOME_CURRENCY,
  countriesFor,
  countriesLeft,
  countryProgress,
  mergeAnswers,
  mergeByCountry,
  needsOccupation,
  nextAsk,
  occupationSkips,
  type Ask,
  type Country,
  type Goal,
} from './plan';
import {
  Actions,
  AskAnswer,
  Bar,
  Forward,
  MAIN_ON_PHONE,
  OptionsAnswer,
  Question,
} from './answers';
import { Flag, QuizIcon, type QuizIconName } from './art';
import { key } from './keys';
import { BarContext } from './pinned';
import { FoundRoutes, Rail } from './rail';
import { OccupationAnswer, type FieldOccupation } from './occupation';
import { FirstResult, Results } from './routes';

/**
 * Where the quiz is shown: `panel` inside the panel's page (its menus around it), `page` alone on a
 * plain page (the logo only: links in ads and messages), `dialog` in a popup over another page.
 */
export type QuizHost = 'panel' | 'page' | 'dialog';

type Stage = 'intro' | 'ask' | 'first' | 'results';
/** One answered question: what it sets for every route, and for each country's own routes. */
interface Part {
  id: string;
  set: Answers;
  byCountry?: CountryAnswers | undefined;
  /** Questions this answer made pointless: counted as answered. */
  skips?: readonly string[] | undefined;
}
/** The questions answered, or skipped by an answer; `never`: questions this server can't take. */
const answeredOf = (parts: readonly Part[], never: readonly string[] = []) =>
  new Set([...never, ...parts.flatMap((part) => [part.id, ...(part.skips ?? [])])]);
/** Everything answered, as Django takes it. */
interface Given {
  answers: Answers;
  byCountry: CountryAnswers;
  /** The first year's budget, asked for study routes with costs; sent apart from the factors. */
  budget: FinderBudget | null;
  /** Monthly income, asked for digital nomad routes; sent apart from the factors. */
  income: FinderIncome | null;
  /** The ISCO code, null for «don't know»; undefined when the occupation wasn't asked (sent only once it was). */
  occupation?: string | null | undefined;
}
const givenOf = (parts: readonly Part[]): Given => {
  const {
    [BUDGET]: budget,
    [INCOME_AMOUNT]: amount,
    [INCOME_CURRENCY]: currency,
    [OCCUPATION]: occupation,
    ...answers
  } = mergeAnswers(Object.fromEntries(parts.map((part) => [part.id, part.set])));
  return {
    answers,
    byCountry: mergeByCountry(parts.map((part) => part.byCountry)),
    budget: typeof budget === 'string' ? (budget as FinderBudget) : null,
    income:
      typeof amount === 'number' && INCOME_CURRENCIES.some((name) => name === currency)
        ? { amount, currency: currency as FinderIncome['currency'] }
        : null,
    occupation:
      occupation === undefined
        ? undefined
        : typeof occupation === 'string' && occupation
          ? occupation
          : null,
  };
};
const GOALS: readonly Goal[] = ['work', 'study', 'any'];
const GOAL_ICONS: Record<Goal, QuizIconName> = { work: 'briefcase', study: 'cap', any: 'compass' };

/**
 * The answers so far, kept on this device (the close sheet promises it): a person who leaves comes
 * back to the same question. Forgotten after two weeks, on "start again" and once nothing is left.
 */
const SAVED_KEY = 'scorize.finder';
const SAVED_DAYS = 14;
interface Saved {
  goal: Goal;
  parts: Part[];
  /** The option picked for each options question, shown again after going back. */
  memory: Record<string, string>;
  at: number;
}
function loadSaved(): Saved | null {
  try {
    const raw = localStorage.getItem(SAVED_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as Partial<Saved>;
    if (
      !saved.goal ||
      !GOALS.includes(saved.goal) ||
      !Array.isArray(saved.parts) ||
      typeof saved.at !== 'number' ||
      Date.now() - saved.at > SAVED_DAYS * 86_400_000
    )
      return null;
    return { goal: saved.goal, parts: saved.parts, memory: saved.memory ?? {}, at: saved.at };
  } catch {
    return null;
  }
}
function save(saved: Omit<Saved, 'at'> | null) {
  try {
    if (saved) localStorage.setItem(SAVED_KEY, JSON.stringify({ ...saved, at: Date.now() }));
    else localStorage.removeItem(SAVED_KEY);
  } catch {
    // Private mode or storage off: the quiz works, it just won't remember.
  }
}

/**
 * The pathway finder (any account), one calm question per screen, the same wherever it is shown
 * (`host`). The person says what they want, then answers: first the fewest questions that answer
 * one route fully. When that route is ready it opens quietly beside the questions (it never takes
 * over the screen), and the person can look at it or keep going for more countries. We say which
 * routes fit; they never pick one.
 */
export function PathwayQuiz({ host, onClose }: { host: QuizHost; onClose?: () => void }) {
  const { t } = useTranslation('pathways');
  const { data: options } = useSuspenseQuery(finderOptionsQuery);
  // An older server sends no field groups: it can't take the field and occupation step, so it is never asked.
  const hasGroups = Boolean(options.field_groups?.length);
  const never = useMemo(() => (hasGroups ? [] : [FIELD_OCCUPATION]), [hasGroups]);
  // Answers kept from an earlier visit: carry on at the next question.
  const [saved] = useState(() => {
    const kept = loadSaved();
    return kept && nextAsk(options.pathways, kept.goal, answeredOf(kept.parts, never))
      ? kept
      : null;
  });
  const [stage, setStage] = useState<Stage>(saved ? 'ask' : 'intro');
  const [goal, setGoal] = useState<Goal | null>(saved?.goal ?? null);
  // Answers by question id, in the order given (Back takes the last one off).
  const [parts, setParts] = useState<Part[]>(saved?.parts ?? []);
  const [memory, setMemory] = useState<Record<string, string>>(saved?.memory ?? {});
  useEffect(() => {
    save(goal ? { goal, parts, memory } : null);
  }, [goal, parts, memory]);
  const [results, setResults] = useState<PathwayResult[]>([]);
  // The routes answered so far, in the order they were found (shown newest first as they arrive).
  const [foundIds, setFoundIds] = useState<number[]>([]);
  // The route opened from them (the route screen).
  const [openId, setOpenId] = useState<number | null>(null);
  const [consulted, setConsulted] = useState(false);

  const answered = useMemo(() => answeredOf(parts, never), [parts, never]);
  const answers = useMemo(() => givenOf(parts), [parts]);
  const pathways = options.pathways;
  const ask = goal ? nextAsk(pathways, goal, answered) : null;
  // The field and occupation step asks only the field when no route asks about occupation lists.
  const askOccupation = goal !== null && needsOccupation(pathways, goal);
  const askText = (part: 'title' | 'help') =>
    ask
      ? t(
          key(
            `asks.${ask.id}.${part}${ask.input === 'occupation' && !askOccupation ? '_field' : ''}`,
          ),
        )
      : '';

  const check = useMutation({
    mutationFn: ({ given, contact }: { given: Given; contact: FinderContact }) =>
      checkPathways(
        given.answers,
        contact,
        given.byCountry,
        given.budget,
        given.income,
        given.occupation,
      ),
  });
  // Found routes' verdicts, fetched in the background while the questions go on.
  const peek = useMutation({
    mutationFn: (given: Given) =>
      checkPathways(
        given.answers,
        { channel: 'none' },
        given.byCountry,
        given.budget,
        given.income,
        given.occupation,
      ),
  });

  /** What the routes say for these answers, then on to `next`. */
  const evaluate = (given: Given, next: Stage) =>
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

  const afterAnswer = (nextParts: Part[]) => {
    setParts(nextParts);
    if (!goal) return;
    const done = answeredOf(nextParts, never);
    const given = givenOf(nextParts);
    if (nextAsk(pathways, goal, done) === null) {
      evaluate(given, 'results');
      return;
    }
    // A route this answer completes: check it (again, after going back) and add it to the row.
    const before = answeredPathways(pathways, goal, answered).map((p) => p.id);
    const fresh = answeredPathways(pathways, goal, done).filter((p) => !before.includes(p.id));
    if (fresh.length) {
      setFoundIds([
        ...foundIds.filter((id) => !fresh.some((p) => p.id === id)),
        ...fresh.map((p) => p.id),
      ]);
      peek.mutate(given, { onSuccess: (data) => setResults(data.results) });
    }
  };

  const restart = () => {
    setParts([]);
    setMemory({});
    setGoal(null);
    setFoundIds([]);
    setOpenId(null);
    setConsulted(false);
    setResults([]);
    setStage('intro');
  };
  /** Back one step: the last answer, the goal, or (past the questions) to the questions. */
  const back = () => {
    if (stage === 'first' || stage === 'results') setStage('ask');
    else if (parts.length) setParts(parts.slice(0, -1));
    else if (goal) setGoal(null);
    else setStage('intro');
  };
  // Inside the panel, the questions take the whole screen (no menus around them); closing goes back to the start.
  const fullScreen = host === 'panel' && stage !== 'intro';
  const frame = {
    host: fullScreen ? ('page' as const) : host,
    onClose: fullScreen ? restart : onClose,
    onRestart: stage === 'intro' ? undefined : restart,
    onBack: back,
    fullScreen,
  };

  if (!pathways.length)
    return (
      <Frame {...frame} screen="empty">
        <EmptyState title={t('empty.title')} variant="card">
          {t('empty.body')}
        </EmptyState>
      </Frame>
    );

  // Back past a route's last question takes it off the row again.
  const ready = goal ? answeredPathways(pathways, goal, answered) : [];
  const found = foundIds
    .map((id) => ready.find((p) => p.id === id))
    .filter((p) => p !== undefined)
    .reverse()
    .map((pathway) => ({ pathway, result: results.find((r) => r.pathway.id === pathway.id) }));
  const open = (id: number) => {
    setOpenId(id);
    setStage('first');
  };
  const opened = found.find((route) => route.pathway.id === openId) ?? found[0];
  const foundRow = found.length ? <FoundRoutes routes={found} onOpen={open} /> : null;

  if (stage === 'results' && goal)
    return (
      <Frame {...frame} screen="results" progress={100}>
        <Results
          results={results.filter((r) =>
            answeredPathways(pathways, goal, answered).some((p) => p.id === r.pathway.id),
          )}
          canAskMore={nextAsk(pathways, goal, answered) !== null}
          onMore={() => setStage('ask')}
          onEdit={restart}
          consulting={check.isPending}
          consulted={consulted}
          onConsult={() =>
            check.mutate(
              { given: answers, contact: { channel: 'call', time: 'now' } },
              {
                // The button itself says it was sent (a toast would cover the bar on phones).
                onSuccess: () => setConsulted(true),
                onError: () => toast.error(t('error')),
              },
            )
          }
        />
      </Frame>
    );

  if (stage === 'intro')
    return (
      <Frame {...frame} screen="intro">
        <Intro pathways={pathways} onStart={() => setStage('ask')} />
      </Frame>
    );

  // The questions: the goal first, then what the routes need.
  const total = 1 + parts.length + asksLeft(pathways, goal ?? 'any', answered);
  const number = goal ? parts.length + 2 : 1;
  const progress = Math.round(((number - 1) / total) * 100);

  if (stage === 'first' && goal)
    return (
      <Frame {...frame} screen="first" progress={progress}>
        <FirstResult
          result={opened?.result}
          first={opened?.pathway.id === foundIds[0]}
          countries={countriesLeft(pathways, goal, answered)}
          busy={check.isPending}
          onMore={() => setStage('ask')}
          onEnough={() => evaluate(answers, 'results')}
        />
      </Frame>
    );

  return (
    <Frame
      {...frame}
      screen={ask?.id ?? 'goal'}
      progress={progress}
      step={{ number, total }}
      rail={
        goal ? <Rail countries={countryProgress(pathways, goal, answered)} peek={foundRow} /> : null
      }
      peek={foundRow}
    >
      {!goal ? (
        <Question key="goal" title={t('goal.title')} help={t('goal.help')} number={number}>
          <OptionsAnswer
            legend={t('goal.title')}
            options={GOALS.map((value) => ({
              value,
              label: t(key(`goal.${value}`)),
              hint: t(key(`goal.${value}_hint`)),
              icon: <QuizIcon name={GOAL_ICONS[value]} />,
            }))}
            busy={check.isPending}
            initial={memory.goal as Goal | undefined}
            onPick={(value) => {
              setGoal(value);
              setMemory({ ...memory, goal: value });
              if (!nextAsk(pathways, value, answered)) evaluate(answers, 'results');
            }}
            actions={(next) => (
              <Actions onBack={() => setStage('intro')} hint={t('keys_hint')}>
                {next}
              </Actions>
            )}
          />
        </Question>
      ) : (
        ask && (
          <Question key={ask.id} title={askText('title')} help={askText('help')} number={number}>
            {ask.input === 'occupation' ? (
              <OccupationAnswer
                groups={options.field_groups ?? []}
                askOccupation={askOccupation}
                initial={rememberedStep(memory[ask.id]) ?? prefilled(options.prefill)}
                busy={check.isPending}
                onAnswer={(step) => {
                  setMemory({ ...memory, [ask.id]: JSON.stringify(step) });
                  const set: Answers =
                    step.field === null ? {} : { field_group: String(step.field) };
                  // Picked: Django checks it against the lists; «don't know»: the yes/no questions as before.
                  if (step.occupation !== undefined) set[OCCUPATION] = step.occupation?.code ?? '';
                  afterAnswer([
                    ...parts,
                    {
                      id: ask.id,
                      set,
                      skips: step.occupation
                        ? occupationSkips(pathways, options.occupation_lists ?? [])
                        : undefined,
                    },
                  ]);
                }}
                actions={(ready, formId) => (
                  <Actions onBack={back} busy={check.isPending}>
                    <Button
                      type="submit"
                      form={formId}
                      size="lg"
                      className={`px-8 ${MAIN_ON_PHONE}`}
                      disabled={check.isPending || !ready}
                    >
                      {t('next')}
                      <Forward />
                    </Button>
                  </Actions>
                )}
              />
            ) : (
              <AskAnswer
                ask={withPrefill(ask, options.prefill?.work_years)}
                countries={countriesFor(pathways, goal, ask, answered)}
                busy={check.isPending}
                onBack={back}
                rates={options.rates}
                remembered={memory[ask.id]}
                allCountries={options.countries}
                onAnswer={(set, byCountry, skips, picked) => {
                  if (picked) setMemory({ ...memory, [ask.id]: picked });
                  afterAnswer([...parts, { id: ask.id, set, byCountry, skips }]);
                }}
                onShowResults={found.length ? () => evaluate(answers, 'results') : undefined}
              />
            )}
          </Question>
        )
      )}
    </Frame>
  );
}

/** The work years from the profile, as the number question's first value (still editable). */
function withPrefill(ask: Ask, workYears: number | null | undefined): Ask {
  if (ask.id !== 'work_years' || typeof workYears !== 'number') return ask;
  const years = Math.round(workYears);
  return { ...ask, start: Math.min(Math.max(years, ask.min ?? 0), ask.max ?? years) };
}

/** The field and occupation from the profile, shown picked. */
const prefilled = (prefill: FinderOptions['prefill']): FieldOccupation => ({
  field: prefill?.field_group ?? null,
  occupation: prefill?.occupation ?? undefined,
});

/** The step's answer given before going back (kept as text with the other remembered picks). */
function rememberedStep(text: string | undefined): FieldOccupation | null {
  if (!text) return null;
  try {
    const step = JSON.parse(text) as FieldOccupation;
    return typeof step === 'object' ? step : null;
  } catch {
    return null;
  }
}

/**
 * The frame on each host. Phones: once the questions start, the quiz fills the screen (no panel
 * menus): its own bar on top, the question scrolling in the middle, the buttons in a bar at the
 * bottom (`slot`).
 */
function frameLook(host: QuizHost, full: boolean) {
  if (host === 'page')
    return {
      frame: 'min-h-dvh max-lg:h-dvh',
      bar: 'sticky top-0 z-20 bg-surface max-lg:flex-none',
      body: 'flex-1 max-lg:min-h-0 max-lg:overflow-y-auto',
    };
  if (host === 'dialog')
    return { frame: 'h-full', bar: 'flex-none', body: 'min-h-0 flex-1 overflow-y-auto' };
  return full
    ? {
        frame:
          'overflow-hidden rounded-3xl shadow-panel max-lg:fixed max-lg:inset-0 max-lg:z-40 max-lg:rounded-none max-lg:shadow-none',
        bar: 'max-lg:flex-none',
        body: 'max-lg:min-h-0 max-lg:flex-1 max-lg:overflow-y-auto',
      }
    : { frame: 'overflow-hidden rounded-3xl shadow-panel', bar: '', body: '' };
}

/**
 * The quiz's frame: a bar with its name, the question count, "start again" and (in a popup) close,
 * the progress under it, then the screen and the countries beside it. Phones, during the questions:
 * back, the count and close on top (close asks first: carry on, start again or leave), the buttons
 * at the bottom.
 */
function Frame({
  host,
  onClose,
  onRestart,
  onBack,
  screen,
  progress,
  step,
  rail,
  peek,
  fullScreen = false,
  children,
}: {
  host: QuizHost;
  /** Over the whole page, its menus hidden. */
  fullScreen?: boolean;
  onClose?: (() => void) | undefined;
  onRestart?: (() => void) | undefined;
  onBack: () => void;
  /** Which screen is shown: a new one starts at the top. */
  screen: string;
  /** 0–100 once the questions start. */
  progress?: number;
  step?: { number: number; total: number };
  rail?: ReactNode;
  /** Phones: the first route's strip, over the buttons. */
  peek?: ReactNode;
  children: ReactNode;
}) {
  const { t } = useTranslation('pathways');
  const f = useFormat();
  const wide = useMediaQuery(DESKTOP_QUERY);
  const keyboard = useKeyboardInset();
  const frameRef = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const [slot, setSlot] = useState<HTMLDivElement | null>(null);
  const [leaving, setLeaving] = useState(false);
  // The questions have started: on phones they take the whole screen.
  const full = Boolean(onRestart);
  const look = frameLook(host, full);
  const pinned = host !== 'panel' || (full && !wide);
  const phoneBar = !wide && full;
  useEffect(() => {
    if (body.current) body.current.scrollTop = 0;
    if (layer.current) layer.current.scrollTop = 0;
    // The page itself scrolls (wide screens, the plain page): bring the new screen's top back.
    const top = frameRef.current?.getBoundingClientRect().top ?? 0;
    if (top < 0) window.scrollBy({ top });
  }, [screen]);
  // Leaving keeps the answers: back to the panel, out of a popup, or to the site from the plain page.
  const leave = fullScreen ? (
    <Link to="/" className={buttonClass('quiet', 'w-full text-text-2', 'md')}>
      {t('exit.leave')}
    </Link>
  ) : host === 'dialog' && onClose ? (
    <button
      type="button"
      className={buttonClass('quiet', 'w-full text-text-2', 'md')}
      onClick={onClose}
    >
      {t('exit.leave')}
    </button>
  ) : host === 'page' ? (
    <a href={SITE.home} className={buttonClass('quiet', 'w-full text-text-2', 'md')}>
      {t('exit.leave')}
    </a>
  ) : (
    <Link to="/" className={buttonClass('quiet', 'w-full text-text-2', 'md')}>
      {t('exit.leave')}
    </Link>
  );
  const layer = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!fullScreen) return;
    // The page under the layer doesn't scroll with it.
    const before = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = before;
    };
  }, [fullScreen]);
  // The screen's own back (Actions), else the quiz's: the top bar's back on phones.
  const screenBack = useRef<(() => void) | null>(null);
  const setBack = useCallback((next: (() => void) | null) => {
    screenBack.current = next;
  }, []);
  const frame = (
    <BarContext value={{ pinned, wide, slot, peek: wide ? null : peek, setBack }}>
      <div ref={frameRef} className={`flex flex-col bg-surface ${look.frame}`}>
        <header className={`pt-[env(safe-area-inset-top)] ${look.bar}`}>
          {host === 'dialog' && !phoneBar && (
            <span
              aria-hidden="true"
              className="mx-auto mt-2 block h-1.5 w-10 rounded-full bg-track lg:hidden"
            />
          )}
          {phoneBar ? (
            <div className="flex min-h-14 items-center gap-1 px-1.5">
              <IconButton
                icon="chevronStart"
                aria-label={t('previous')}
                onClick={() => {
                  (screenBack.current ?? onBack)();
                }}
              />
              <span className="flex-1 text-center text-label font-semibold text-text-2 tabular-nums">
                {step
                  ? t('question_of', { number: f.number(step.number), total: f.number(step.total) })
                  : t('title')}
              </span>
              <IconButton
                icon="close"
                aria-label={t('close')}
                aria-haspopup="dialog"
                onClick={() => setLeaving(true)}
              />
            </div>
          ) : (
            <div className="mx-auto flex min-h-14 w-full max-w-6xl items-center gap-2 px-5 lg:min-h-16 lg:gap-4 lg:px-14">
              {host === 'page' && (
                <a href={SITE.home} aria-label={t('home')} className="flex min-h-11 items-center">
                  <Logo className="text-xl" />
                </a>
              )}
              <span
                className={`flex items-center gap-2 font-bold ${
                  host === 'page'
                    ? 'text-small font-medium text-text-2 max-lg:sr-only'
                    : 'text-base'
                }`}
              >
                <QuizIcon name="compass" size={20} className="text-primary-text" />
                {t('title')}
              </span>
              <span className="flex-1" />
              {step && (
                <span className="text-sm text-text-2 tabular-nums">
                  {t('step', { number: f.number(step.number), total: f.number(step.total) })}
                </span>
              )}
              {onRestart && (
                <button
                  type="button"
                  onClick={onRestart}
                  className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-full px-3 text-small text-text-2 hover:bg-canvas hover:text-text"
                >
                  <QuizIcon name="restart" size={18} />
                  <span className="max-lg:sr-only">{t('restart')}</span>
                </button>
              )}
              {onClose && (
                <IconButton
                  icon="close"
                  aria-label={t('close')}
                  onClick={onClose}
                  className="bg-canvas"
                />
              )}
            </div>
          )}
          {progress !== undefined && (
            <ProgressBar
              size="sm"
              value={progress}
              label={t('progress')}
              className={`mx-auto max-w-6xl ${phoneBar ? 'mx-4' : ''}`}
            />
          )}
        </header>
        <div ref={body} className={look.body}>
          <div
            className={`mx-auto grid w-full max-w-6xl gap-4 px-4 pt-3 pb-6 lg:gap-10 lg:px-14 lg:py-10 ${
              rail ? 'lg:grid-cols-[minmax(0,1fr)_17rem]' : ''
            }`}
          >
            <div className={`min-w-0 ${rail ? 'max-w-3xl' : ''}`}>{children}</div>
            {rail && <aside className="flex min-w-0 flex-col max-lg:order-first">{rail}</aside>}
          </div>
        </div>
        {!wide && pinned && (
          <div
            ref={setSlot}
            className="flex-none bg-surface shadow-[0_-1px_0_var(--hair)] empty:hidden"
            style={{
              paddingBottom: keyboard
                ? `${String(keyboard + 12)}px`
                : 'max(0.75rem, env(safe-area-inset-bottom))',
            }}
          />
        )}
        {phoneBar && (
          <Sheet
            open={leaving}
            onClose={() => setLeaving(false)}
            title={t('exit.title')}
            closeLabel={t('exit.dismiss')}
          >
            <p className="m-0 text-small text-text-2">{t('exit.body')}</p>
            <div className="flex flex-col gap-1 pt-2">
              <Button size="lg" className="mb-1 w-full" onClick={() => setLeaving(false)}>
                {t('exit.stay')}
              </Button>
              <button
                type="button"
                className={buttonClass('quiet', 'w-full', 'md')}
                onClick={() => {
                  setLeaving(false);
                  onRestart?.();
                }}
              >
                <QuizIcon name="restart" size={18} />
                {t('exit.restart')}
              </button>
              {leave}
            </div>
          </Sheet>
        )}
      </div>
    </BarContext>
  );
  return fullScreen
    ? createPortal(
        <div
          ref={layer}
          role="dialog"
          aria-modal="true"
          aria-label={t('title')}
          className="fixed inset-0 z-50 overflow-y-auto bg-surface"
        >
          {frame}
        </div>,
        document.body,
      )
    : frame;
}

/** Up to three of the countries checked, floating round a compass (wide screens). */
const ORB_RINGS = ['8%', '28%'];
const ORBIT = [
  { top: '3%', insetInlineStart: '40%' },
  { top: '56%', insetInlineStart: '2%' },
  { top: '62%', insetInlineStart: '74%' },
];

function Intro({ pathways, onStart }: { pathways: FinderPathway[]; onStart: () => void }) {
  const { t } = useTranslation('pathways');
  const f = useFormat();
  const wide = useMediaQuery(DESKTOP_QUERY);
  const countries: Country[] = [
    ...new Map(pathways.map((p) => [p.country.id, p.country])).values(),
  ];
  const fact = (icon: ReactNode, value: string, label: string) => (
    <li className="flex items-center gap-3">
      {icon}
      <span className="flex flex-col">
        <span className="text-body font-bold text-text lg:text-lg">{value}</span>
        {label}
      </span>
    </li>
  );
  const tile = (name: QuizIconName) => (
    <span
      aria-hidden="true"
      className="flex size-11 items-center justify-center rounded-[14px] bg-canvas text-primary-text"
    >
      <QuizIcon name={name} size={22} />
    </span>
  );
  return (
    <div className="grid animate-rise items-center gap-10 lg:grid-cols-[minmax(0,1fr)_17rem]">
      <div className="flex flex-col gap-2 lg:gap-4">
        <p className="m-0 text-label font-semibold text-primary-text lg:text-small">
          {t('intro.eyebrow')}
        </p>
        <h1 className="m-0 text-display font-extrabold tracking-tight text-balance">
          {t('intro.title')}
        </h1>
        <p className="m-0 max-w-xl text-body text-text-2 lg:text-xl lg:leading-8">
          {t('intro.body')}
        </p>
        <ul className="m-0 flex list-none flex-wrap gap-x-8 gap-y-4 p-0 py-4 text-small text-text-2 lg:py-6">
          {fact(tile('clock'), t('intro.time'), t('intro.time_label'))}
          {fact(
            <span aria-hidden="true" className="flex ps-2">
              {countries.slice(0, 3).map((country) => (
                <span
                  key={country.id}
                  className="size-9 rounded-full bg-surface p-0.5"
                  style={{ marginInlineStart: '-0.5rem' }}
                >
                  <span className="block size-full overflow-hidden rounded-full">
                    <Flag code={country.code} name={country.name} />
                  </span>
                </span>
              ))}
            </span>,
            t('intro.countries', { count: countries.length, n: f.number(countries.length) }),
            f.list(countries.map((country) => country.name)),
          )}
          {fact(tile('seal'), t('intro.free'), t('intro.free_label'))}
        </ul>
        <Bar stick={false}>
          <Button size="lg" className={`px-8 ${MAIN_ON_PHONE}`} onClick={onStart} autoFocus={wide}>
            {t('intro.start')}
            <Forward />
          </Button>
        </Bar>
      </div>
      <div
        aria-hidden="true"
        className="relative rounded-full max-lg:hidden"
        style={{
          aspectRatio: '1',
          background: 'radial-gradient(closest-side, var(--tint), transparent)',
        }}
      >
        {ORB_RINGS.map((inset) => (
          <span
            key={inset}
            className="absolute rounded-full border border-hair"
            style={{ inset }}
          />
        ))}
        <span
          className="absolute flex items-center justify-center rounded-full bg-primary text-on-primary shadow-panel"
          style={{ inset: '38%' }}
        >
          <QuizIcon name="compass" size={40} />
        </span>
        {countries.slice(0, 3).map((country, index) => (
          <span
            key={country.id}
            className="absolute rounded-full bg-surface p-1 shadow-panel"
            style={{ ...ORBIT[index], width: '21%', height: '21%' }}
          >
            <span className="block size-full overflow-hidden rounded-full">
              <Flag code={country.code} name={country.name} />
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
