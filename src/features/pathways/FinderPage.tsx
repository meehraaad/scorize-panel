import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { useMemo, useState, type SyntheticEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Chip, type ChipTone } from '@/components/ui/Chip';
import { ChoiceGroup } from '@/components/ui/Choices';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageStack } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { TextField } from '@/components/ui/TextField';
import {
  checkPathways,
  finderOptionsQuery,
  type Answers,
  type FinderContact,
  type PathwayResult,
} from '@/lib/applicant/pathways';
import { toast } from '@/lib/toast';
import {
  answeredPathways,
  countriesLeft,
  mergeAnswers,
  nextAsk,
  type Ask,
  type Goal,
} from './plan';
import type { ParseKeys } from 'i18next';

/** A key built at run time (a question's, a status's): one of this dictionary's. */
const key = (name: string) => name as ParseKeys<'pathways'>;

type Stage = 'goal' | 'ask' | 'first' | 'results';
const GOALS: readonly Goal[] = ['work', 'study', 'any'];

/**
 * The pathway finder (any account). The person says what they want, then answers one question at a
 * time: first the fewest that answer one route fully, so they see a first country early, then more
 * questions for more countries. We say which routes fit; they never pick one.
 */
export default function FinderPage() {
  const { t } = useTranslation('pathways');
  const { data: options } = useSuspenseQuery(finderOptionsQuery);
  const [stage, setStage] = useState<Stage>('goal');
  const [goal, setGoal] = useState<Goal | null>(null);
  // Answers by question id, in the order given (Back takes the last one off).
  const [parts, setParts] = useState<{ id: string; set: Answers }[]>([]);
  const [results, setResults] = useState<PathwayResult[]>([]);
  const [shownFirst, setShownFirst] = useState(false);

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
    if (!shownFirst && answeredPathways(pathways, goal, done).length > 0) {
      setShownFirst(true);
      evaluate(given, 'first');
    }
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

  return (
    <PageStack>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      {stage === 'goal' && (
        <SectionCard id="finder-goal" title={t('goal.title')} variant="panel">
          <ChoiceGroup
            legend={t('goal.title')}
            hideLegend
            look="cards"
            options={GOALS.map((value) => ({ value, label: t(key(`goal.${value}`)) }))}
            value={goal}
            onChange={(value) => {
              setGoal(value);
              if (nextAsk(pathways, value, answered)) setStage('ask');
              else evaluate(answers, 'results');
            }}
          />
        </SectionCard>
      )}
      {stage === 'ask' && goal && ask && (
        <Question
          key={ask.id}
          ask={ask}
          number={parts.length + 1}
          busy={check.isPending}
          onBack={() => (parts.length ? setParts(parts.slice(0, -1)) : setStage('goal'))}
          onAnswer={(set) => afterAnswer([...parts, { id: ask.id, set }])}
          onShowResults={shownFirst ? () => evaluate(answers, 'results') : undefined}
        />
      )}
      {stage === 'first' && goal && (
        <FirstResult
          result={results.find((r) =>
            answeredPathways(pathways, goal, answered).some((p) => p.id === r.pathway.id),
          )}
          countries={countriesLeft(pathways, goal, answered)}
          onMore={() => setStage('ask')}
          onEnough={() => setStage('results')}
        />
      )}
      {stage === 'results' && goal && (
        <Results
          results={results.filter((r) =>
            answeredPathways(pathways, goal, answered).some((p) => p.id === r.pathway.id),
          )}
          canAskMore={nextAsk(pathways, goal, answered) !== null}
          onMore={() => setStage('ask')}
          onEdit={() => {
            setParts([]);
            setShownFirst(false);
            setStage('goal');
          }}
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
      )}
    </PageStack>
  );
}

function Question({
  ask,
  number,
  busy,
  onBack,
  onAnswer,
  onShowResults,
}: {
  ask: Ask;
  number: number;
  busy: boolean;
  onBack: () => void;
  onAnswer: (set: Answers) => void;
  /** Once a first route is answered: stop here and see the routes so far. */
  onShowResults?: (() => void) | undefined;
}) {
  const { t } = useTranslation('pathways');
  const [typed, setTyped] = useState('');
  const value = Number(typed.replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))));
  const valid =
    typed.trim() !== '' &&
    Number.isFinite(value) &&
    value >= (ask.min ?? 0) &&
    value <= (ask.max ?? 150);
  const submit = (event: SyntheticEvent) => {
    event.preventDefault();
    if (valid) onAnswer({ [ask.factors[0] ?? ask.id]: value });
  };
  return (
    <SectionCard
      id="finder-question"
      variant="panel"
      title={t(key(`asks.${ask.id}.title`))}
      subtitle={t(key(`asks.${ask.id}.help`))}
      badge={
        <Chip tone="neutral" small>
          {t('question', { number })}
        </Chip>
      }
    >
      {ask.input === 'options' ? (
        <ChoiceGroup
          legend={t(key(`asks.${ask.id}.title`))}
          hideLegend
          look="cards"
          options={(ask.options ?? []).map((option) => ({
            value: option.id,
            label: t(key(`asks.${ask.id}.options.${option.id}`)),
          }))}
          value={null}
          onChange={(id) => {
            const option = ask.options?.find((candidate) => candidate.id === id);
            if (option && !busy) onAnswer(option.set);
          }}
        />
      ) : (
        <form className="flex flex-col gap-4" onSubmit={submit}>
          <TextField
            label={t(key(`asks.${ask.id}.label`))}
            inputMode="numeric"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            error={typed && !valid ? t('number_error') : undefined}
          />
          <Button type="submit" disabled={!valid || busy}>
            {t('next')}
          </Button>
        </form>
      )}
      <div className="flex flex-wrap gap-3">
        <Button variant="outline" onClick={onBack} disabled={busy}>
          {t('back')}
        </Button>
        {onShowResults && (
          <Button variant="outline" onClick={onShowResults} disabled={busy}>
            {t('results.show')}
          </Button>
        )}
      </div>
    </SectionCard>
  );
}

const verdict = (result: PathwayResult): { tone: ChipTone; key: string } =>
  result.qualifies
    ? { tone: 'good', key: 'fit.good' }
    : result.eligible
      ? { tone: 'warn', key: 'fit.close' }
      : { tone: 'neutral', key: 'fit.not_now' };

function RouteCard({ result }: { result: PathwayResult }) {
  const { t } = useTranslation('pathways');
  const { pathway } = result;
  const fit = verdict(result);
  return (
    <SectionCard
      id={`route-${pathway.id}`}
      variant="panel"
      title={pathway.name}
      subtitle={pathway.country.name}
      badge={<Chip tone={fit.tone}>{t(key(fit.key))}</Chip>}
    >
      {pathway.summary && <p className="m-0 text-[15px] leading-8">{pathway.summary}</p>}
      {pathway.pass_mark !== null && (
        <p className="m-0 text-sm text-text-2">
          {t('points', { points: result.points, pass: pathway.pass_mark })}
        </p>
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
        <div className="flex flex-col gap-1 rounded-xl bg-warn-tint p-3">
          <span className="text-sm font-semibold text-warn">{t('tip')}</span>
          <span className="text-sm leading-7">{pathway.tip}</span>
        </div>
      )}
      {(pathway.duration || pathway.cost) && (
        <div className="flex flex-wrap gap-4 text-sm text-text-2">
          {pathway.duration && <span>{t('duration', { value: pathway.duration })}</span>}
          {pathway.cost && (
            <span>{t('cost.label', { value: t(key(`cost.${pathway.cost}`)) })}</span>
          )}
        </div>
      )}
    </SectionCard>
  );
}

function FirstResult({
  result,
  countries,
  onMore,
  onEnough,
}: {
  result: PathwayResult | undefined;
  countries: { id: number; name: string; left: number }[];
  onMore: () => void;
  onEnough: () => void;
}) {
  const { t } = useTranslation('pathways');
  const nextCountry = countries[0];
  return (
    <>
      <h2 className="m-0 font-display text-xl font-bold">{t('first.title')}</h2>
      {result && <RouteCard result={result} />}
      {countries.length > 0 && (
        <SectionCard id="finder-more" variant="panel" title={t('first.more')}>
          <ul className="m-0 flex list-none flex-col p-0">
            {countries.map((country) => (
              <li
                key={country.id}
                className="border-line flex min-h-11 items-center justify-between gap-3 border-b last:border-b-0"
              >
                <span className="text-[15px]">{country.name}</span>
                <span className="text-sm text-text-2">
                  {t('first.left', { count: country.left })}
                </span>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}
      <div className="flex flex-wrap gap-3">
        {nextCountry && (
          <Button onClick={onMore}>
            {t('first.continue', { count: nextCountry.left, country: nextCountry.name })}
          </Button>
        )}
        <Button variant="outline" onClick={onEnough}>
          {t('first.enough')}
        </Button>
      </div>
    </>
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
  const fitting = results.filter((r) => r.eligible).slice(0, 3);
  const others = results.filter((r) => !fitting.includes(r));
  return (
    <>
      <h2 className="m-0 font-display text-xl font-bold">
        {fitting.length ? t('results.title', { count: fitting.length }) : t('results.none')}
      </h2>
      {fitting.map((result) => (
        <RouteCard key={result.pathway.id} result={result} />
      ))}
      {others.length > 0 && (
        <SectionCard id="finder-not-now" variant="panel" title={t('results.not_now')}>
          <ul className="m-0 flex flex-col gap-2 ps-5 text-sm leading-7">
            {others.map((result) => (
              <li key={result.pathway.id}>
                {t('results.not_now_line', {
                  country: result.pathway.country.name,
                  name: result.pathway.name,
                  why: result.missing.join('، ') || t('results.points_short'),
                })}
              </li>
            ))}
          </ul>
        </SectionCard>
      )}
      <SectionCard
        id="finder-consult"
        variant="panel"
        title={t('consult.title')}
        subtitle={t('consult.body')}
      >
        <Button onClick={onConsult} disabled={consulting}>
          {t('consult.button')}
        </Button>
      </SectionCard>
      <div className="flex flex-wrap gap-3">
        {canAskMore && (
          <Button variant="outline" onClick={onMore}>
            {t('results.more')}
          </Button>
        )}
        <Button variant="outline" onClick={onEdit}>
          {t('results.edit')}
        </Button>
      </div>
      <p className="m-0 text-[13px] leading-7 text-text-2">{t('results.disclaimer')}</p>
    </>
  );
}
