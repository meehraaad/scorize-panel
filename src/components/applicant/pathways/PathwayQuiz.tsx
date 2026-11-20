import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { Logo } from '@/components/ui/Logo';
import { ProgressBar } from '@/components/ui/Progress';
import {
  checkPathways,
  finderOptionsQuery,
  type Answers,
  type CountryAnswers,
  type FinderContact,
  type FinderPathway,
  type PathwayResult,
} from '@/lib/applicant/pathways';
import { useFormat } from '@/lib/i18n/useFormat';
import { SITE } from '@/lib/site';
import { toast } from '@/lib/toast';
import {
  answeredPathways,
  asksLeft,
  countriesFor,
  countriesLeft,
  countryProgress,
  mergeAnswers,
  mergeByCountry,
  nextAsk,
  type Country,
  type Goal,
} from './plan';
import { Actions, AskAnswer, Forward, OptionsAnswer, Question } from './answers';
import { Flag, QuizIcon, type QuizIconName } from './art';
import { key } from './keys';
import { PinnedContext } from './pinned';
import { Peek, Rail } from './rail';
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
}
/** Everything answered, as Django takes it. */
interface Given {
  answers: Answers;
  byCountry: CountryAnswers;
}
const givenOf = (parts: readonly Part[]): Given => ({
  answers: mergeAnswers(Object.fromEntries(parts.map((part) => [part.id, part.set]))),
  byCountry: mergeByCountry(parts.map((part) => part.byCountry)),
});
const GOALS: readonly Goal[] = ['work', 'study', 'any'];
const GOAL_ICONS: Record<Goal, QuizIconName> = { work: 'briefcase', study: 'cap', any: 'compass' };

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
  const [stage, setStage] = useState<Stage>('intro');
  const [goal, setGoal] = useState<Goal | null>(null);
  // Answers by question id, in the order given (Back takes the last one off).
  const [parts, setParts] = useState<Part[]>([]);
  const [results, setResults] = useState<PathwayResult[]>([]);
  // The route answered first: shown beside the questions once it is ready.
  const [firstId, setFirstId] = useState<number | null>(null);

  const answered = useMemo(() => new Set(parts.map((part) => part.id)), [parts]);
  const answers = useMemo(() => givenOf(parts), [parts]);
  const pathways = options.pathways;
  const ask = goal ? nextAsk(pathways, goal, answered) : null;

  const check = useMutation({
    mutationFn: ({ given, contact }: { given: Given; contact: FinderContact }) =>
      checkPathways(given.answers, contact, given.byCountry),
  });
  // The first route's verdict, fetched in the background while the questions go on.
  const peek = useMutation({
    mutationFn: (given: Given) =>
      checkPathways(given.answers, { channel: 'none' }, given.byCountry),
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
    const done = new Set(nextParts.map((part) => part.id));
    const given = givenOf(nextParts);
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
  const frame = { host, onClose, onRestart: stage === 'intro' ? undefined : restart };

  if (!pathways.length)
    return (
      <Frame {...frame} screen="empty">
        <EmptyState title={t('empty.title')} variant="card">
          {t('empty.body')}
        </EmptyState>
      </Frame>
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
      <Frame {...frame} screen="results" progress={100}>
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
          result={firstResult}
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
              icon: <QuizIcon name={GOAL_ICONS[value]} />,
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
              countries={countriesFor(pathways, goal, ask)}
              busy={check.isPending}
              onBack={() => (parts.length ? setParts(parts.slice(0, -1)) : setGoal(null))}
              onAnswer={(set, byCountry) => afterAnswer([...parts, { id: ask.id, set, byCountry }])}
              onShowResults={firstReady ? () => evaluate(answers, 'results') : undefined}
            />
          </Question>
        )
      )}
    </Frame>
  );
}

const FRAMES: Record<QuizHost, { frame: string; bar: string; body: string }> = {
  panel: { frame: 'overflow-hidden rounded-3xl shadow-panel', bar: '', body: '' },
  page: {
    frame: 'min-h-dvh',
    bar: 'sticky top-0 z-20 bg-surface',
    body: 'flex-1',
  },
  dialog: { frame: 'h-full', bar: 'flex-none', body: 'min-h-0 flex-1 overflow-y-auto' },
};

/**
 * The quiz's frame: a bar with its name, the question count, "start again" and (in a popup) close,
 * the progress under it, then the screen and the countries beside it.
 */
function Frame({
  host,
  onClose,
  onRestart,
  screen,
  progress,
  step,
  rail,
  children,
}: {
  host: QuizHost;
  onClose?: (() => void) | undefined;
  onRestart?: (() => void) | undefined;
  /** Which screen is shown: a new one starts at the top. */
  screen: string;
  /** 0–100 once the questions start. */
  progress?: number;
  step?: { number: number; total: number };
  rail?: ReactNode;
  children: ReactNode;
}) {
  const { t } = useTranslation('pathways');
  const f = useFormat();
  const body = useRef<HTMLDivElement>(null);
  const look = FRAMES[host];
  useEffect(() => {
    if (body.current) body.current.scrollTop = 0;
  }, [screen]);
  return (
    <PinnedContext value={host !== 'panel'}>
      <div className={`flex flex-col bg-surface ${look.frame}`}>
        <header className={look.bar}>
          {host === 'dialog' && (
            <span
              aria-hidden="true"
              className="mx-auto mt-2 block h-1.5 w-10 rounded-full bg-track lg:hidden"
            />
          )}
          <div className="mx-auto flex min-h-14 w-full max-w-6xl items-center gap-2 px-5 lg:min-h-16 lg:gap-4 lg:px-14">
            {host === 'page' && (
              <a href={SITE.home} aria-label={t('home')} className="flex min-h-11 items-center">
                <Logo className="text-xl" />
              </a>
            )}
            <span
              className={`flex items-center gap-2 font-bold ${
                host === 'page' ? 'text-[15px] font-medium text-text-2 max-lg:sr-only' : 'text-base'
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
                className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-full px-3 text-[15px] text-text-2 hover:bg-canvas hover:text-text"
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
          {progress !== undefined && (
            <ProgressBar
              size="sm"
              value={progress}
              label={t('progress')}
              className="mx-auto max-w-6xl"
            />
          )}
        </header>
        <div ref={body} className={look.body}>
          <div
            className={`mx-auto grid w-full max-w-6xl gap-8 px-5 py-8 lg:gap-10 lg:px-14 lg:py-10 ${
              rail ? 'lg:grid-cols-[minmax(0,1fr)_17rem]' : ''
            }`}
          >
            <div className={`min-w-0 ${rail ? 'max-w-3xl' : ''}`}>{children}</div>
            {rail && <aside className="min-w-0 max-lg:order-first">{rail}</aside>}
          </div>
        </div>
      </div>
    </PinnedContext>
  );
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
  const countries: Country[] = [
    ...new Map(pathways.map((p) => [p.country.id, p.country])).values(),
  ];
  const fact = (icon: ReactNode, value: string, label: string) => (
    <li className="flex items-center gap-3">
      {icon}
      <span className="flex flex-col">
        <span className="text-lg leading-7 font-bold text-text">{value}</span>
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
      <div className="flex flex-col gap-4">
        <p className="m-0 text-[15px] font-semibold text-primary-text">{t('intro.eyebrow')}</p>
        <h1 className="m-0 text-5xl leading-tight font-extrabold tracking-tight text-balance">
          {t('intro.title')}
        </h1>
        <p className="m-0 max-w-xl text-lg leading-8 text-text-2 lg:text-xl">{t('intro.body')}</p>
        <ul className="m-0 flex list-none flex-wrap gap-x-8 gap-y-4 p-0 py-6 text-sm text-text-2">
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
        <div>
          <Button size="lg" className="px-8" onClick={onStart} autoFocus>
            {t('intro.start')}
            <Forward />
          </Button>
        </div>
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
