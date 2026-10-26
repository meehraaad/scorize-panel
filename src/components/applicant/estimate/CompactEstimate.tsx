import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Button } from '@/components/ui/Button';
import { buttonClass } from '@/components/ui/buttonStyles';
import { Card } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { Icon, type IconName } from '@/components/ui/Icon';
import { lockButtonOnHero } from '@/components/ui/Lock';
import { ProgressRing } from '@/components/ui/Progress';
import { useFormat } from '@/lib/i18n/useFormat';
import {
  BAND_BAR,
  type Band,
  type CountryEstimate,
  type EstimateAnswers,
  type EstimateOptions,
  type EstimateResult,
} from '@/lib/applicant/estimate';
import { Quiz } from './Quiz';

/** Questions in the quiz (Quiz's steps), for the start button. */
const QUESTIONS = 5;
/** Countries named on the start card before "+n". */
const SHOWN_COUNTRIES = 5;

/**
 * On phones: the quiz as one card with a start button (or the result in brief, with a way to answer
 * again); the questions open in a bottom sheet, which closes on the result.
 * Design: "Mobile Quiz Card Mockups" canvas (C · Chance gauge, the sheet, the result in brief).
 */
export function CompactEstimate({
  latest,
  options,
  contact,
  onDone,
  detailsTo,
}: {
  latest: EstimateResult | null;
  options: EstimateOptions;
  contact: EstimateAnswers['contact'] | null;
  onDone: (contact: EstimateAnswers['contact']) => void;
  detailsTo?: string | undefined;
}) {
  const { t } = useTranslation('estimate');
  const [open, setOpen] = useState(false);
  const best = latest?.countries[0];
  const start = () => setOpen(true);

  return (
    <>
      {latest && best ? (
        <ResultBrief
          result={latest}
          best={best}
          contact={contact}
          detailsTo={detailsTo}
          onRetake={start}
        />
      ) : (
        <StartCard options={options} empty={latest !== null} onStart={start} />
      )}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={t('title')}
        closeLabel={t('sheet.close')}
      >
        <Quiz
          options={options}
          inSheet
          onDone={(answer) => {
            onDone(answer);
            setOpen(false);
          }}
        />
      </Dialog>
    </>
  );
}

const PERKS = [
  { key: 'instant', icon: 'chart' },
  { key: 'consultant', icon: 'user' },
  { key: 'similar', icon: 'graduation' },
] as const satisfies readonly { key: string; icon: IconName }[];

/**
 * Before the quiz: a gauge whose needle waits on their answers, the countries it compares and
 * what they get. `empty`: they answered, but no country had enough outcomes.
 */
function StartCard({
  options,
  empty,
  onStart,
}: {
  options: EstimateOptions;
  empty: boolean;
  onStart: () => void;
}) {
  const { t } = useTranslation('estimate');
  const f = useFormat();
  const shown = options.countries.slice(0, SHOWN_COUNTRIES);
  const more = options.countries.length - shown.length;

  return (
    <Card aria-labelledby="estimate-start" className="flex flex-col gap-4 p-5">
      <div className="flex items-center gap-4">
        <Gauge />
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-xs font-semibold text-primary-text">{t('sheet.kicker')}</span>
          <h2
            id="estimate-start"
            className="m-0 font-display text-[17px] leading-relaxed font-bold"
          >
            {t(empty ? 'result.emptyTitle' : 'sheet.title')}
          </h2>
        </div>
      </div>
      <p className="m-0 text-sm leading-7 text-text-2">
        {t(empty ? 'result.empty' : 'sheet.text')}
      </p>
      {shown.length > 0 && (
        <div className="flex flex-col gap-2">
          <span id="estimate-start-countries" className="text-xs text-text-2">
            {t('sheet.countries')}
          </span>
          <ul
            aria-labelledby="estimate-start-countries"
            className="m-0 flex list-none flex-wrap gap-2 p-0"
          >
            {shown.map((country) => (
              <li
                key={country.id}
                className="inline-flex h-8 items-center rounded-full bg-canvas px-3.5 text-[13px] font-semibold shadow-[inset_0_0_0_1px_var(--hair)]"
              >
                {country.name}
              </li>
            ))}
            {more > 0 && (
              <li className="inline-flex h-8 items-center rounded-full px-2 text-[13px] text-text-2">
                {t('sheet.more', { n: f.number(more) })}
              </li>
            )}
          </ul>
        </div>
      )}
      <Button size="lg" className="w-full" onClick={onStart}>
        {t(empty ? 'result.retake' : 'sheet.start')}
        {!empty && (
          <span className="font-medium opacity-85">
            {t('sheet.questions', { n: f.number(QUESTIONS) })}
          </span>
        )}
      </Button>
      <ul className="m-0 grid list-none grid-cols-3 gap-2 p-0 pt-3.5 shadow-[inset_0_1px_0_var(--hair)]">
        {PERKS.map(({ key, icon }) => (
          <li
            key={key}
            className="flex flex-col items-center gap-1.5 text-center text-xs leading-5 text-text-2"
          >
            <Icon name={icon} size={20} className="text-primary-text" />
            {t(`sheet.perks.${key}`)}
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** A half-circle meter from low to high, its needle on a question mark: decoration. */
function Gauge() {
  const { t } = useTranslation('estimate');
  return (
    <span aria-hidden="true" className="relative flex-none">
      <svg width="120" height="68" viewBox="0 0 200 112" fill="none">
        <path d="M20 100 A80 80 0 0 1 58 32" strokeWidth="16" className="stroke-tint" />
        <path d="M62 29.5 A80 80 0 0 1 138 29.5" strokeWidth="16" className="stroke-hero-accent" />
        <path d="M142 32 A80 80 0 0 1 180 100" strokeWidth="16" className="stroke-primary" />
        <path
          d="M100 100 L128 46"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray="2 9"
          className="stroke-text"
        />
        <circle cx="100" cy="100" r="9" className="fill-text" />
      </svg>
      <span className="absolute inset-x-0 -bottom-1.5 text-center font-display text-[13px] font-bold text-primary-text">
        {t('sheet.gaugeMark')}
      </span>
    </span>
  );
}

const BAND_TEXT: Record<Band, string> = {
  high: 'text-live',
  medium: 'text-hero-current',
  low: 'text-hero-danger',
};

/**
 * After the quiz: the best country on a ring, the others as chips with their level, when the
 * consultant will be in touch (asked for in this visit), the full result and a way to answer again.
 */
function ResultBrief({
  result,
  best,
  contact,
  detailsTo,
  onRetake,
}: {
  result: EstimateResult;
  best: CountryEstimate;
  contact: EstimateAnswers['contact'] | null;
  detailsTo?: string | undefined;
  onRetake: () => void;
}) {
  const { t } = useTranslation('estimate');
  const f = useFormat();
  const level = (estimate: CountryEstimate) =>
    estimate.chance === null
      ? t(`band.${estimate.band}`)
      : t('result.percent', { n: f.number(estimate.chance) });
  const others = result.countries.slice(1);

  return (
    <section
      aria-labelledby="estimate-best"
      className="flex flex-col gap-[18px] rounded-[24px] bg-hero px-5 pt-[22px] pb-5 text-on-hero shadow-hero"
    >
      <div className="flex items-center gap-4">
        <span className="relative flex-none">
          <ProgressRing
            value={best.chance ?? BAND_BAR[best.band]}
            label={t('result.ring', { country: best.country.name, level: level(best) })}
            size={84}
            tone="onHero"
          />
          <span
            aria-hidden="true"
            className="absolute inset-0 flex items-center justify-center font-display text-[17px] font-bold"
          >
            {level(best)}
          </span>
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-[13px] font-semibold text-hero-current">
            {t('result.bestKicker')}
          </span>
          <h2
            id="estimate-best"
            className="m-0 font-display text-[22px] leading-snug font-bold"
            aria-label={t('result.best', { country: best.country.name })}
          >
            {best.country.name}
          </h2>
          <span className="text-[13px] text-on-hero-2">{t('result.bestChance')}</span>
        </div>
      </div>

      {others.length > 0 && (
        <div className="flex flex-col gap-2 pt-4 shadow-[inset_0_1px_0_var(--hero-line)]">
          <h3 id="estimate-others" className="m-0 text-[13px] font-normal text-on-hero-2">
            {t('result.others')}
          </h3>
          <ul aria-labelledby="estimate-others" className="m-0 flex list-none flex-wrap gap-2 p-0">
            {others.map((estimate) => (
              <li
                key={estimate.country.id}
                className="inline-flex h-10 items-center gap-2 rounded-[14px] bg-hero-raised px-3.5 text-sm font-semibold"
              >
                {estimate.country.name}
                <span
                  className={`inline-flex items-center gap-1 text-xs font-medium ${BAND_TEXT[estimate.band]}`}
                >
                  <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
                  {level(estimate)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {contact && contact.channel !== 'none' && (
        <p className="m-0 flex items-start gap-2.5 rounded-2xl bg-hero-raised px-3.5 py-3 text-[13px] leading-6">
          <Icon name="check" size={18} className="mt-0.5 flex-none text-live" />
          {t(`result.call.${contact.channel}.${contact.time}`)}
        </p>
      )}

      <div className="flex gap-2">
        {detailsTo && (
          <Link to={detailsTo} className={buttonClass('primary', 'flex-[2]')}>
            {t('result.details')}
          </Link>
        )}
        <Button variant="outline" className={`flex-1 ${lockButtonOnHero}`} onClick={onRetake}>
          {t('result.retake')}
        </Button>
      </div>
    </section>
  );
}
