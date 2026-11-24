import { use, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { AnswerGroup, CheckTile } from '@/components/ui/AnswerChoices';
import { ChoiceGroup } from '@/components/ui/Choices';
import { NumberStepper } from '@/components/ui/NumberStepper';
import { TextField } from '@/components/ui/TextField';
import type { Answers, CountryAnswers, FinderOptions } from '@/lib/applicant/pathways';
import { useFormat } from '@/lib/i18n/useFormat';
import { toLatinDigits } from '@/lib/text';
import {
  INCOME_AMOUNT,
  INCOME_CURRENCIES,
  INCOME_CURRENCY,
  type Ask,
  type Country,
  type EnglishScale,
  type IncomeCurrency,
} from './plan';
import { Flag, LevelBars, QuizIcon, type QuizIconName } from './art';
import { key } from './keys';
import { BarContext } from './pinned';

/** How long a picked answer stays shown before the next question comes in. */
const PICK_DELAY = 280;
/** Questions whose options rise in level: drawn as a level meter. */
const LEVEL_ASKS = new Set([
  'education',
  'english',
  'german',
  'budget',
  'remote_months',
  'employer_years',
]);
/** Yes/no questions, drawn as yes and no. */
const YES_NO_ICONS: Record<string, QuizIconName> = { yes: 'briefcase', no: 'none' };
/** Options that mean "I don't know": drawn without a level. */
const UNSURE = 'unsure';
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
      {/* Phones show the number in the bar on top. */}
      <p className="m-0 text-label font-semibold text-primary-text max-lg:sr-only lg:text-small">
        {t('question', { number: f.number(number) })}
      </p>
      <h1 className="m-0 mt-2 text-title font-extrabold tracking-tight text-balance lg:mt-3">
        {title}
      </h1>
      <p className="m-0 mt-1 max-w-xl text-lead text-text-2 lg:mt-3">{help}</p>
      <div className="flex flex-col gap-5 pt-5 lg:gap-10 lg:pt-10">{children}</div>
    </div>
  );
}

/** The arrow of "next" and "start": pointing the way the page reads. */
export function Forward() {
  return <QuizIcon name="forward" size={20} className="rtl:-scale-x-100" />;
}

/**
 * A screen's buttons. Wide screens: a row under the answers (kept in view where pinned). Phones,
 * pinned: a bar at the bottom of the screen, in thumb reach, the main button full width, the first
 * route's strip above it, lifted over the on-screen keyboard. `stick={false}`: never sticky on wide
 * screens (the start screen).
 */
export function Bar({ children, stick = true }: { children: ReactNode; stick?: boolean }) {
  const { pinned, wide, slot, peek } = use(BarContext);
  if (wide)
    return (
      <div
        className={`flex flex-wrap items-center gap-3 ${pinned && stick ? 'sticky bottom-0 z-10 bg-surface py-3' : ''}`}
      >
        {children}
      </div>
    );
  if (!pinned) return <div className="flex flex-col gap-2">{children}</div>;
  if (!slot) return null;
  return createPortal(
    <div className="flex flex-col gap-2 px-4 pt-3">
      {peek}
      {children}
    </div>,
    slot,
  );
}

/** The main button's look on phones: full width, 52px. */
export const MAIN_ON_PHONE = 'max-lg:min-h-cta max-lg:w-full';

/** Under a question: its buttons, then (wide screens) "back" and a hint; phones go back at the top. */
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
  const { wide, setBack } = use(BarContext);
  // The top bar's back (phones) goes where this screen's back goes (yes or no, from the countries).
  const backRef = useRef(onBack);
  useEffect(() => {
    backRef.current = onBack;
  });
  useEffect(() => {
    setBack(() => backRef.current());
    return () => {
      setBack(null);
    };
  }, [setBack]);
  return (
    <Bar>
      {children}
      {wide && (
        <Button variant="outline" size="lg" onClick={onBack} disabled={busy}>
          {t('back')}
        </Button>
      )}
      {wide && hint && <span className="text-sm text-text-2">{hint}</span>}
    </Bar>
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
      className={`px-8 ${MAIN_ON_PHONE}`}
      disabled={disabled}
    >
      {t('next')}
      <Forward />
    </Button>
  );
}

/**
 * Large answers; a click or the option's number on the keyboard picks it and moves on. `initial`:
 * a remembered or prefilled answer, shown picked; "next" keeps it (`actions` draws the
 * buttons around that "next").
 */
export function OptionsAnswer<T extends string>({
  legend,
  options,
  busy,
  onPick,
  initial = null,
  actions,
}: {
  legend: string;
  options: { value: T; label: string; hint?: string; icon?: ReactNode }[];
  busy: boolean;
  onPick: (value: T) => void;
  initial?: T | null | undefined;
  actions?: (next: ReactNode) => ReactNode;
}) {
  const { t } = useTranslation('pathways');
  const f = useFormat();
  const { wide } = use(BarContext);
  const [selected, setSelected] = useState<T | null>(
    options.some((option) => option.value === initial) ? initial : null,
  );
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
  const pick = (value: T) => {
    if (busy || picked !== null) return;
    setSelected(value);
    setPicked(value);
  };
  const pickRefFn = useRef(pick);
  useEffect(() => {
    pickRefFn.current = pick;
  });
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.metaKey || event.ctrlKey || event.altKey || target?.closest('input,textarea'))
        return;
      const option = options[Number(toLatinDigits(event.key)) - 1];
      if (option) pickRefFn.current(option.value);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [options]);
  // Phones always show Next. On desktop it also appears when there is an answer to keep.
  const next =
    wide && selected === null ? null : (
      <Button
        size="lg"
        className={`px-8 ${MAIN_ON_PHONE}`}
        disabled={busy || selected === null || picked !== null}
        onClick={() => {
          if (selected !== null) pick(selected);
        }}
      >
        {t('next')}
        <Forward />
      </Button>
    );
  return (
    <>
      <AnswerGroup
        legend={legend}
        options={options.map((option, index) => ({
          ...option,
          extra: (
            <span
              aria-hidden="true"
              className="flex size-7 flex-none items-center justify-center rounded-lg bg-surface text-label text-text-2 shadow-[inset_0_0_0_1px_var(--line-2)] max-lg:hidden"
            >
              {f.number(index + 1)}
            </span>
          ),
        }))}
        value={selected}
        onPick={pick}
      />
      {actions?.(next)}
    </>
  );
}

export function AskAnswer({
  ask,
  countries,
  busy,
  onBack,
  onAnswer,
  onShowResults,
  rates,
  remembered,
  allCountries,
}: {
  ask: Ask;
  /** `countries` questions: the countries asked about. */
  countries: Country[];
  busy: boolean;
  onBack: () => void;
  /** `picked`: the option chosen (options questions), remembered for going back. */
  onAnswer: (
    set: Answers,
    byCountry?: CountryAnswers,
    skips?: readonly string[],
    picked?: string,
  ) => void;
  /** The option chosen before going back to this question. */
  remembered?: string | undefined;
  /** `countries` questions: every country, for one with no route ("a job offer from Spain"). */
  allCountries?: readonly Country[] | undefined;
  /** Today's rates, to show an income in euros as it is typed. */
  rates?: FinderOptions['rates'] | undefined;
  /** Once a first route is ready: stop here and see the routes so far. */
  onShowResults?: (() => void) | undefined;
}) {
  const { t } = useTranslation('pathways');
  const f = useFormat();
  const formId = useId();
  const min = ask.min ?? 0;
  const max = ask.max ?? 100;
  const [value, setValue] = useState(ask.start ?? min);
  const [scale, setScale] = useState<EnglishScale>(ask.scales?.[0] ?? 'ielts');
  const { wide } = use(BarContext);
  // Phones show the first route's strip above the buttons instead.
  const early = wide && onShowResults && (
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
        allCountries={allCountries ?? []}
        formId={formId}
        busy={busy}
        onAnswer={(byCountry) => onAnswer({}, byCountry)}
        actions={(ready, back, picking, next) => (
          <Actions
            onBack={back ?? onBack}
            busy={busy}
            {...(picking ? {} : { hint: t('keys_hint') })}
          >
            {picking ? <Next formId={formId} disabled={busy || !ready} /> : next}
            {early}
          </Actions>
        )}
      />
    );
  if (ask.input === 'options') {
    const options = ask.options ?? [];
    const levels = options.filter((option) => option.id !== UNSURE).length;
    // In another exam's scores, every option but "no certificate" is worded in that exam.
    const scaled = (id: string) =>
      ask.scales && scale !== 'ielts' && id !== 'none'
        ? t(key(`asks.${ask.id}.${scale}.${id}`))
        : t(key(`asks.${ask.id}.options.${id}`));
    return (
      <>
        {ask.scales && (
          <div className="flex flex-col gap-2">
            <span className="text-sm text-text-2">{t('asks.english.scale')}</span>
            <ChoiceGroup
              legend={t('asks.english.scale')}
              hideLegend
              look="segmented"
              options={ask.scales.map((value) => ({
                value,
                label: t(key(`asks.english.scales.${value}`)),
              }))}
              value={scale}
              onChange={setScale}
            />
          </div>
        )}
        <OptionsAnswer
          key={scale}
          legend={t(key(`asks.${ask.id}.title`))}
          options={options.map((option, index) => ({
            value: option.id,
            label: scaled(option.id),
            icon:
              option.id === UNSURE ? (
                <QuizIcon name="none" />
              ) : LEVEL_ASKS.has(ask.id) ? (
                <LevelBars level={index} of={levels} />
              ) : (ask.id === 'remote_work' || ask.id === 'skilled_occupation') &&
                YES_NO_ICONS[option.id] ? (
                <QuizIcon name={YES_NO_ICONS[option.id] ?? 'none'} />
              ) : ask.id === 'partner' && PARTNER_ICONS[option.id] ? (
                <QuizIcon name={PARTNER_ICONS[option.id] ?? 'user'} />
              ) : undefined,
          }))}
          busy={busy}
          initial={remembered}
          onPick={(id) => {
            const option = options.find((candidate) => candidate.id === id);
            if (option) onAnswer(option.set, undefined, option.skips, id);
          }}
          actions={(next) => (
            <Actions onBack={onBack} busy={busy} hint={t('keys_hint')}>
              {next}
              {early}
            </Actions>
          )}
        />
      </>
    );
  }
  if (ask.input === 'money')
    return (
      <MoneyAnswer
        formId={formId}
        busy={busy}
        rates={rates}
        onAnswer={onAnswer}
        actions={(ready) => (
          <Actions onBack={onBack} busy={busy}>
            <Next formId={formId} disabled={busy || !ready} />
            {early}
          </Actions>
        )}
      />
    );
  const label = t(key(`asks.${ask.id}.label`));
  return (
    <>
      <form
        id={formId}
        className="flex max-w-md flex-col gap-6 max-lg:items-center max-lg:pt-3"
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
        <div className="flex flex-col gap-2 max-lg:hidden">
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
            className="flex justify-between text-label text-text-2 tabular-nums"
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

/** What "yes" looks like on each question about destinations. */
const DESTINATION_ICONS: Record<string, QuizIconName> = {
  job_offer: 'briefcase',
  shortage_occupation: 'target',
  listed_occupation: 'target',
  skills_assessment: 'seal',
  recognition: 'seal',
  stay_months: 'compass',
};
/** How many other countries a search shows at once. */
const SEARCH_LIMIT = 6;

/**
 * One question about destinations ("a formal job offer from an employer abroad?"), first as yes or no, since most
 * people say no and move on. On yes, which countries: those with a route first, and any other by search ("Spain"),
 * each with how long or how fully. Every country gets its own answer, so a job offer from one never counts for
 * another; one with no route counts for none, but the sales team sees it.
 */
function CountriesAnswer({
  ask,
  countries,
  allCountries,
  formId,
  busy,
  onAnswer,
  actions,
}: {
  ask: Ask;
  countries: Country[];
  allCountries: readonly Country[];
  formId: string;
  busy: boolean;
  onAnswer: (byCountry: CountryAnswers) => void;
  /** The buttons, told whether a country is picked, where Back goes, and whether countries are being picked. */
  actions: (
    ready: boolean,
    back: (() => void) | undefined,
    picking: boolean,
    /** Next button for the yes/no question. */
    next?: ReactNode,
  ) => ReactNode;
}) {
  const { t } = useTranslation('pathways');
  const f = useFormat();
  const factor = ask.factors[0] ?? ask.id;
  const [picking, setPicking] = useState(false);
  // Picked countries, each with its detail: years there, or how fully the degree is recognised.
  const [picked, setPicked] = useState<Record<number, number | string>>({});
  // Countries without a route the person added by search, in the order added.
  const [extra, setExtra] = useState<Country[]>([]);
  const [search, setSearch] = useState('');
  const answerFor = (value: number | string | undefined): Answers => {
    if (ask.detail === 'years') return { [factor]: typeof value === 'number' ? value * MONTHS : 0 };
    if (ask.detail === 'recognition')
      return { [factor]: typeof value === 'string' ? value : 'none' };
    return { [factor]: value !== undefined };
  };
  if (!picking)
    return (
      <>
        <OptionsAnswer
          legend={t(key(`asks.${ask.id}.title`))}
          options={(['yes', 'no'] as const).map((value) => ({
            value,
            label: t(key(`asks.${ask.id}.${value}`)),
            icon: (
              <QuizIcon name={value === 'yes' ? (DESTINATION_ICONS[ask.id] ?? 'target') : 'none'} />
            ),
          }))}
          busy={busy}
          onPick={(value) => {
            if (value === 'yes') setPicking(true);
            else
              onAnswer(
                Object.fromEntries(countries.map((country) => [country.id, answerFor(undefined)])),
              );
          }}
          actions={(next) => actions(false, undefined, false, next)}
        />
      </>
    );
  const shown = [...countries, ...extra];
  const query = search.trim().toLowerCase();
  const found = query
    ? allCountries
        .filter(
          (country) =>
            !shown.some((one) => one.id === country.id) &&
            country.name.toLowerCase().includes(query),
        )
        .slice(0, SEARCH_LIMIT)
    : [];
  const pick = (country: Country, checked: boolean) =>
    setPicked((now) =>
      checked
        ? {
            ...now,
            [country.id]:
              ask.detail === 'recognition' ? 'full' : ask.detail === 'years' ? 2 : 'yes',
          }
        : Object.fromEntries(Object.entries(now).filter(([id]) => Number(id) !== country.id)),
    );
  const ready = Object.keys(picked).length > 0;
  return (
    <>
      <form
        id={formId}
        className="grid gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (busy || !ready) return;
          onAnswer(
            Object.fromEntries(shown.map((country) => [country.id, answerFor(picked[country.id])])),
          );
        }}
      >
        <p className="m-0 text-lg font-semibold">{t(key(`asks.${ask.id}.which`))}</p>
        {shown.map((country) => {
          const detail = picked[country.id];
          return (
            <CheckTile
              key={country.id}
              label={country.name}
              icon={<Flag code={country.code} name={country.name} />}
              note={
                ask.detail === 'years' && typeof detail === 'number'
                  ? t('countries.years_note', { count: detail, n: f.number(detail) })
                  : undefined
              }
              checked={detail !== undefined}
              onChange={(checked) => pick(country, checked)}
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
        {allCountries.length > 0 && (
          <div className="flex flex-col gap-2 pt-2">
            <TextField
              label={t('countries.other')}
              placeholder={t('countries.search')}
              autoComplete="off"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.preventDefault();
              }}
            />
            {found.length > 0 && (
              <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
                {found.map((country) => (
                  <li key={country.id}>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setExtra((now) => [...now, country]);
                        pick(country, true);
                        setSearch('');
                      }}
                    >
                      <Flag code={country.code} name={country.name} />
                      {country.name}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            {query && found.length === 0 && (
              <p className="m-0 text-sm text-text-2">{t('countries.not_found')}</p>
            )}
          </div>
        )}
      </form>
      {actions(ready, () => setPicking(false), true)}
    </>
  );
}

/** Tomans are typed in millions ("۱۵۰" million), euros and dollars as they are. */
const TOMAN_UNIT = 1_000_000;

/**
 * The income itself: an amount, in tomans by default or in euros or dollars (people paid from abroad know it in
 * those), shown in euros at today's rate as it is typed, since routes ask a minimum in euros.
 */
function MoneyAnswer({
  formId,
  busy,
  rates,
  onAnswer,
  actions,
}: {
  formId: string;
  busy: boolean;
  rates?: FinderOptions['rates'] | undefined;
  onAnswer: (set: Answers) => void;
  actions: (ready: boolean) => ReactNode;
}) {
  const { t } = useTranslation('pathways');
  const f = useFormat();
  const [currency, setCurrency] = useState<IncomeCurrency>('toman');
  const [text, setText] = useState('');
  const typed = Number(toLatinDigits(text).replace(/[^\d.]/g, ''));
  const amount = Number.isFinite(typed) && typed > 0 ? typed : null;
  const sent =
    amount === null ? null : Math.round(currency === 'toman' ? amount * TOMAN_UNIT : amount);
  const tomans =
    sent === null
      ? null
      : currency === 'toman'
        ? sent
        : currency === 'usd' && rates?.usd
          ? sent * rates.usd
          : null;
  const euros =
    currency === 'eur'
      ? sent
      : tomans !== null && rates?.eur
        ? Math.round(tomans / rates.eur)
        : null;
  const label = t(key(`asks.income.label_${currency}`));
  return (
    <>
      <form
        id={formId}
        className="flex max-w-md flex-col gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          if (!busy && sent !== null)
            onAnswer({ [INCOME_AMOUNT]: sent, [INCOME_CURRENCY]: currency });
        }}
      >
        <ChoiceGroup
          legend={t('asks.income.currency')}
          hideLegend
          look="segmented"
          options={INCOME_CURRENCIES.map((value) => ({
            value,
            label: t(key(`asks.income.currencies.${value}`)),
          }))}
          value={currency}
          onChange={(value) => {
            setCurrency(value);
            setText('');
          }}
        />
        <TextField
          size="lg"
          label={label}
          inputMode="decimal"
          autoComplete="off"
          value={text}
          onChange={(event) => setText(event.target.value)}
          hint={
            currency !== 'eur' && euros !== null
              ? t('asks.income.in_euros', { amount: f.number(euros) })
              : currency !== 'eur' && sent !== null
                ? t('asks.income.no_rate')
                : t('asks.income.hint')
          }
        />
      </form>
      {actions(sent !== null)}
    </>
  );
}
