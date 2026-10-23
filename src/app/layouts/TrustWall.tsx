import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/ui/Icon';
import { Logo } from '@/components/ui/Logo';
import { useFormat } from '@/lib/i18n/useFormat';
import { SITE, SUPPORT_PHONE, formatPhone } from '@/lib/site';
import { TRUST, type AdmissionLetter } from './trustContent';

/*
 * The dark "why Scorize" side of the login page (design: "Scorize Login & Register" canvas).
 * Desktop: a full-height column beside the form. Mobile: a short header the form sheet overlaps.
 * With no real admission letters yet, both show the applicant journey instead.
 */

const JOURNEY = ['consultation', 'contract', 'documents', 'apply', 'admission', 'visa'] as const;

// Where each letter sits in the stack (desktop). Percent offsets keep them inside narrow columns.
const LETTER_LAYOUT = [
  { top: '0px', start: '8%', rotate: '-4deg', delay: '0s' },
  { top: '110px', start: '24%', rotate: '3deg', delay: '1.2s' },
  { top: '200px', start: '2%', rotate: '-2deg', delay: '2.4s' },
] as const;

function Headline({ className }: { className: string }) {
  const { t } = useTranslation();
  return (
    <p className={`m-0 font-display leading-[1.5] font-bold ${className}`}>
      {t(TRUST.letters.length ? 'trust.headline' : 'trust.journeyHeadline')}
    </p>
  );
}

function Stats({ className, valueClass }: { className: string; valueClass: string }) {
  const { t } = useTranslation();
  const format = useFormat();
  if (!TRUST.stats) return null;
  const items = [
    ['admissions', TRUST.stats.admissions],
    ['countries', TRUST.stats.countries],
    ['years', TRUST.stats.years],
  ] as const;
  return (
    <dl className={`m-0 ${className}`}>
      {items.map(([key, value]) => (
        <div key={key} className="flex flex-col-reverse gap-1">
          <dt className="text-[13px] text-on-hero-2">{t(`trust.stats.${key}`)}</dt>
          <dd className={`m-0 font-bold ${valueClass}`}>{format.number(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

function Letter({ letter, index }: { letter: AdmissionLetter; index: number }) {
  const { t } = useTranslation();
  const format = useFormat();
  const layout = LETTER_LAYOUT[index % LETTER_LAYOUT.length] ?? LETTER_LAYOUT[0];
  return (
    // A paper letter: light colours in both themes.
    <li
      data-theme="light"
      className="absolute flex w-[min(340px,72%)] animate-drift flex-col gap-2.5 rounded-[20px] bg-surface px-5 py-[18px] text-text shadow-[0_24px_50px_rgb(0_0_0/0.35)] motion-reduce:animate-none"
      style={{
        top: layout.top,
        insetInlineStart: layout.start,
        rotate: layout.rotate,
        animationDelay: layout.delay,
        zIndex: index + 1,
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex h-[26px] items-center gap-1.5 rounded-full bg-good-tint px-2.5 text-xs font-bold text-good">
          <Icon name="check" size={12} />
          {t('trust.admitted')}
        </span>
        <span className="text-xs text-text-2">{format.relativeDays(-letter.daysAgo)}</span>
      </div>
      <div dir="ltr" className="flex flex-col gap-0.5 text-left">
        <span className="text-[19px] font-semibold tracking-tight">{letter.university}</span>
        <span className="text-sm text-text-2">{letter.program}</span>
      </div>
      <div className="flex items-center gap-2.5 pt-2.5 shadow-[inset_0_1px_0_var(--hair)]">
        <span className="flex size-[30px] items-center justify-center rounded-[10px] bg-tint text-[13px] font-bold text-primary-text">
          {letter.applicant.charAt(0)}
        </span>
        <span className="text-[13px] text-neutral">
          {t('trust.applicant', {
            name: letter.applicant,
            degree: t(`trust.degree.${letter.degree}`),
          })}
        </span>
      </div>
    </li>
  );
}

function Journey() {
  const { t } = useTranslation();
  return (
    <ol className="m-0 flex max-w-[520px] list-none flex-col gap-3 p-0">
      {JOURNEY.map((stage, index) => (
        <li
          key={stage}
          className="flex items-center gap-4 rounded-[20px] bg-hero-raised px-4 py-3.5"
          style={{ marginInlineStart: `${(index % 3) * 24}px` }}
        >
          <span className="flex size-9 flex-none items-center justify-center rounded-xl bg-primary text-sm font-bold text-on-primary">
            <Icon name="check" size={16} />
          </span>
          <span className="flex flex-col gap-0.5">
            <span className="text-[15px] font-semibold">{t(`trust.journey.${stage}.title`)}</span>
            <span className="text-[13px] text-on-hero-2">{t(`trust.journey.${stage}.text`)}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

function LiveLabel() {
  const { t } = useTranslation();
  return (
    <span className="inline-flex items-center gap-2.5 text-sm text-on-hero-2">
      <span className="size-2 rounded-full bg-live shadow-[0_0_0_4px_color-mix(in_srgb,var(--live)_20%,transparent)]" />
      {t(TRUST.letters.length ? 'trust.live' : 'trust.journeyLabel')}
    </span>
  );
}

/** Desktop: the full-height column. */
export function TrustWall() {
  const { t } = useTranslation();
  return (
    <aside
      aria-label={t('trust.label')}
      className="relative hidden flex-[1.15_1_0] flex-col justify-between gap-8 overflow-hidden bg-hero px-14 py-12 text-on-hero lg:flex"
    >
      <div
        aria-hidden="true"
        className="absolute -start-40 -bottom-52 size-[560px] rounded-full bg-primary/35 blur-[10px]"
      />
      <div className="relative flex max-w-[520px] flex-col gap-4">
        <LiveLabel />
        <Headline className="text-[34px]" />
      </div>

      {TRUST.letters.length ? (
        <ul aria-label={t('trust.lettersLabel')} className="relative m-0 h-[330px] list-none p-0">
          {TRUST.letters.slice(0, LETTER_LAYOUT.length).map((letter, index) => (
            <Letter key={letter.university} letter={letter} index={index} />
          ))}
        </ul>
      ) : (
        <div className="relative">
          <Journey />
        </div>
      )}

      <div className="relative flex flex-col gap-7">
        <Stats
          className="grid grid-cols-3 gap-3 pt-6 shadow-[inset_0_1px_0_var(--hero-line)]"
          valueClass="text-[26px]"
        />
        <p className="m-0 flex max-w-[420px] items-start gap-3 text-[13px] leading-[1.8] text-on-hero-2">
          <Icon name="lock" size={18} className="mt-0.5 flex-none" />
          {t('trust.security')}
        </p>
      </div>
    </aside>
  );
}

/** Mobile: brand, support phone, headline and a ticker of recent admissions. */
export function TrustHeader() {
  const { t } = useTranslation();
  const format = useFormat();
  return (
    <section
      aria-label={t('trust.label')}
      className="flex flex-col gap-[18px] bg-hero px-5 pt-5 pb-[52px] text-on-hero lg:hidden"
    >
      <div className="flex items-center justify-between">
        <a href={SITE.home} aria-label={t('auth.homeLink')} className="flex min-h-11 items-center">
          <Logo tone="onHero" className="text-lg" />
        </a>
        <a
          href={`tel:${SUPPORT_PHONE}`}
          dir="ltr"
          className="inline-flex min-h-11 items-center gap-1.5 text-[13px] text-on-hero-2"
        >
          <Icon name="phone" size={14} />
          {format.digits(formatPhone(SUPPORT_PHONE))}
        </a>
      </div>
      <Headline className="text-xl" />
      {TRUST.letters.length > 0 && (
        <ul
          aria-label={t('trust.lettersLabel')}
          className="-mx-5 my-0 flex list-none gap-2 overflow-hidden px-5"
        >
          {TRUST.letters.map((letter) => (
            <li
              key={letter.university}
              className="inline-flex h-9 flex-none items-center gap-2 rounded-full bg-hero-raised px-3.5 text-[13px] whitespace-nowrap"
            >
              <span className="size-2 rounded-full bg-live" />
              <span dir="ltr">{letter.short}</span>
              <span className="text-on-hero-2">{letter.applicant}</span>
            </li>
          ))}
        </ul>
      )}
      <Stats className="flex gap-[18px]" valueClass="text-[15px]" />
    </section>
  );
}
