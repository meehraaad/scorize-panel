import { use, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { AnswerGroup, CheckTile } from '@/components/ui/AnswerChoices';
import { ChoiceGroup } from '@/components/ui/Choices';
import { NumberStepper } from '@/components/ui/NumberStepper';
import type { Answers, CountryAnswers } from '@/lib/applicant/pathways';
import { useFormat } from '@/lib/i18n/useFormat';
import { toLatinDigits } from '@/lib/text';
import type { Ask, Country } from './plan';
import { Flag, LevelBars, QuizIcon, type QuizIconName } from './art';
import { key } from './keys';
import { PinnedContext } from './pinned';

/** How long a picked answer stays shown before the next question comes in. */
const PICK_DELAY = 280;
/** Questions whose options rise in level: drawn as a level meter. */
const LEVEL_ASKS = new Set(['education', 'english', 'german']);
/** The partner question's options, drawn as people. */
const PARTNER_ICONS: Record<string, QuizIconName> = {
  single: 'user',
  skilled: 'briefcase',
  english: 'chat',
  other: 'users',
};
/** Months in a year: `stay_months` is asked in years. */
const MONTHS = 12;

/** One question: its number and topic, the question in large type, a line of help, then the answer. */
export function Question({
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
      <div className="flex flex-col gap-10 pt-8 lg:pt-10">{children}</div>
    </div>
  );
}

/** The arrow of "next" and "start": pointing the way the page reads. */
export function Forward() {
  return <QuizIcon name="forward" size={20} className="rtl:-scale-x-100" />;
}

export function Actions({
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
  const pinned = use(PinnedContext);
  return (
    <div
      className={`flex flex-wrap items-center gap-3 ${pinned ? 'sticky bottom-0 z-10 bg-surface py-3' : ''}`}
    >
      {children}
      <Button variant="outline" size="lg" onClick={onBack} disabled={busy}>
        {t('back')}
      </Button>
      {hint && <span className="text-sm text-text-2 max-lg:hidden">{hint}</span>}
    </div>
  );
}

/** The primary "next" of a question that needs one (a number, countries). */
function Next({ formId, disabled }: { formId: string; disabled: boolean }) {
  const { t } = useTranslation('pathways');
  return (
    <Button
      type="submit"
      form={formId}
      size="lg"
      className="px-8 max-lg:flex-1"
      disabled={disabled}
    >
      {t('next')}
      <Forward />
    </Button>
  );
}

/** Large answers; a click or the option's number on the keyboard picks it and moves on. */
export function OptionsAnswer<T extends string>({
  legend,
  options,
  busy,
  onPick,
}: {
  legend: string;
  options: { value: T; label: string; hint?: string; icon?: ReactNode }[];
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
    <AnswerGroup
      legend={legend}
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

export function AskAnswer({
  ask,
  countries,
  busy,
  onBack,
  onAnswer,
  onShowResults,
}: {
  ask: Ask;
  /** `countries` questions: the countries asked about. */
  countries: Country[];
  busy: boolean;
  onBack: () => void;
  onAnswer: (set: Answers, byCountry?: CountryAnswers) => void;
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
  if (ask.input === 'countries')
    return (
      <CountriesAnswer
        ask={ask}
        countries={countries}
        formId={formId}
        busy={busy}
        onAnswer={(byCountry) => onAnswer({}, byCountry)}
        actions={(ready) => (
          <Actions onBack={onBack} busy={busy}>
            <Next formId={formId} disabled={busy || !ready} />
            {early}
          </Actions>
        )}
      />
    );
  if (ask.input === 'options') {
    const options = ask.options ?? [];
    return (
      <>
        <OptionsAnswer
          legend={t(key(`asks.${ask.id}.title`))}
          options={options.map((option, index) => ({
            value: option.id,
            label: t(key(`asks.${ask.id}.options.${option.id}`)),
            icon: LEVEL_ASKS.has(ask.id) ? (
              <LevelBars level={index} of={options.length} />
            ) : ask.id === 'partner' && PARTNER_ICONS[option.id] ? (
              <QuizIcon name={PARTNER_ICONS[option.id] ?? 'user'} />
            ) : undefined,
          }))}
          busy={busy}
          onPick={(id) => {
            const option = options.find((candidate) => candidate.id === id);
            if (option) onAnswer(option.set);
          }}
        />
        <Actions onBack={onBack} busy={busy} hint={t('keys_hint')}>
          {early}
        </Actions>
      </>
    );
  }
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
        <Next formId={formId} disabled={busy} />
        {early}
      </Actions>
    </>
  );
}

/**
 * One question about every destination at once ("which countries have you lived in?"): the person
 * ticks the countries it is true of, says how long or how fully for each, or answers "none". Every
 * country listed gets its own answer, so living in one never counts for another.
 */
function CountriesAnswer({
  ask,
  countries,
  formId,
  busy,
  onAnswer,
  actions,
}: {
  ask: Ask;
  countries: Country[];
  formId: string;
  busy: boolean;
  onAnswer: (byCountry: CountryAnswers) => void;
  /** The buttons, told whether an answer is given (a country, or "none"). */
  actions: (ready: boolean) => ReactNode;
}) {
  const { t } = useTranslation('pathways');
  const f = useFormat();
  const factor = ask.factors[0] ?? ask.id;
  // Picked countries, each with its detail: years there, or how fully the degree is recognised.
  const [picked, setPicked] = useState<Record<number, number | string>>({});
  const [none, setNone] = useState(false);
  const answerFor = (value: number | string | undefined): Answers => {
    if (ask.detail === 'years') return { [factor]: typeof value === 'number' ? value * MONTHS : 0 };
    if (ask.detail === 'recognition')
      return { [factor]: typeof value === 'string' ? value : 'none' };
    return { [factor]: value !== undefined };
  };
  const ready = none || Object.keys(picked).length > 0;
  return (
    <>
      <form
        id={formId}
        className="grid gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (busy || !ready) return;
          onAnswer(
            Object.fromEntries(
              countries.map((country) => [country.id, answerFor(picked[country.id])]),
            ),
          );
        }}
      >
        {countries.map((country) => {
          const detail = picked[country.id];
          return (
            <CheckTile
              key={country.id}
              label={country.name}
              icon={<Flag code={country.code} name={country.name} />}
              note={
                typeof detail === 'number'
                  ? t('countries.years_note', { count: detail, n: f.number(detail) })
                  : undefined
              }
              checked={detail !== undefined}
              onChange={(checked) => {
                setNone(false);
                setPicked((now) =>
                  checked
                    ? { ...now, [country.id]: ask.detail === 'recognition' ? 'full' : 2 }
                    : Object.fromEntries(
                        Object.entries(now).filter(([id]) => Number(id) !== country.id),
                      ),
                );
              }}
            >
              {ask.detail === 'years' && typeof detail === 'number' && (
                <NumberStepper
                  label={t('countries.years_of', { country: country.name })}
                  value={detail}
                  onChange={(years) => setPicked((now) => ({ ...now, [country.id]: years }))}
                  min={1}
                  max={40}
                  unit={t('countries.years')}
                  decreaseLabel={t('less')}
                  increaseLabel={t('more')}
                />
              )}
              {ask.detail === 'recognition' && typeof detail === 'string' && (
                <ChoiceGroup
                  legend={t('countries.how_fully', { country: country.name })}
                  hideLegend
                  look="segmented"
                  options={(['full', 'partial'] as const).map((value) => ({
                    value,
                    label: t(key(`choices.recognition.${value}`)),
                  }))}
                  value={detail}
                  onChange={(value) => setPicked((now) => ({ ...now, [country.id]: value }))}
                />
              )}
            </CheckTile>
          );
        })}
        <CheckTile
          label={t(key(`asks.${ask.id}.none`))}
          icon={<QuizIcon name="none" />}
          checked={none}
          onChange={(checked) => {
            setNone(checked);
            if (checked) setPicked({});
          }}
        />
      </form>
      {actions(ready)}
    </>
  );
}
