import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Button } from '@/components/ui/Button';
import { buttonClass } from '@/components/ui/buttonStyles';
import { Dialog } from '@/components/ui/Dialog';
import { Icon } from '@/components/ui/Icon';
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

/** The locked chances' look: a shape, blurred, not anyone's chance. */
const VEILED = [78, 64, 51];

/**
 * Before the quiz, on the premium card: the countries it compares with their chances locked, one
 * thing the result will tell them, and the way in. `empty`: they answered, but no country had
 * enough outcomes.
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
  const shown = options.countries.slice(0, VEILED.length);

  return (
    <section
      aria-labelledby="estimate-start"
      className="flex flex-col gap-[18px] rounded-[22px] px-5 pt-6 pb-5 text-on-hero shadow-luxe bg-luxe"
    >
      <div className="flex flex-col gap-2">
        <h2
          id="estimate-start"
          className="m-0 font-display text-[21px] leading-[1.7] font-semibold"
        >
          {empty ? (
            t('result.emptyTitle')
          ) : (
            <Trans
              ns="estimate"
              i18nKey="sheet.title"
              components={{ em: <span className="text-luxe-gold-light" /> }}
            />
          )}
        </h2>
        <p className="m-0 text-sm leading-7 text-on-luxe-2">
          {t(empty ? 'result.empty' : 'sheet.text')}
        </p>
      </div>
      {!empty && shown.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-3 rounded-[14px] bg-hero-raised p-4 shadow-[inset_0_0_0_1px_var(--hero-line)]">
          {shown.map((country, at) => (
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
      )}
      {!empty && (
        <p className="m-0 flex items-start gap-2.5 text-sm leading-7">
          <span
            aria-hidden="true"
            className="mt-0.5 flex size-[22px] flex-none items-center justify-center rounded-full bg-luxe-gold text-[13px] font-extrabold"
          >
            {t('preview.mark')}
          </span>
          {t('preview.tease.country')}
        </p>
      )}
      <div className="flex flex-col gap-2.5">
        <button
          type="button"
          onClick={onStart}
          className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-[14px] bg-luxe-gold text-base font-extrabold active:scale-[0.98]"
        >
          {t(empty ? 'result.retake' : 'sheet.start')}
          <Icon name="chevronEnd" size={18} />
        </button>
        {!empty && (
          <p className="m-0 text-center text-xs text-on-luxe-2">
            {t('sheet.note', { n: f.number(QUESTIONS) })}
          </p>
        )}
      </div>
    </section>
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
      className="flex flex-col gap-[18px] rounded-[24px] px-5 pt-[22px] pb-5 text-on-hero shadow-luxe bg-luxe"
    >
      <div className="flex items-center gap-4">
        <span className="relative flex-none">
          <ProgressRing
            value={best.chance ?? BAND_BAR[best.band]}
            label={t('result.ring', { country: best.country.name, level: level(best) })}
            size={84}
            tone="luxe"
          />
          <span
            aria-hidden="true"
            className="absolute inset-0 flex items-center justify-center font-display text-[17px] font-bold text-luxe-gold-light"
          >
            {level(best)}
          </span>
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <span className="self-start rounded-full bg-luxe-gold px-3 py-0.5 text-xs font-extrabold">
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
