import { use, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/ui/Icon';
import type { FinderPathway, PathwayResult } from '@/lib/applicant/pathways';
import { useFormat } from '@/lib/i18n/useFormat';
import type { Country } from './plan';
import { Flag, QuizIcon, SmallFlag } from './art';
import { key } from './keys';
import { BarContext } from './pinned';
import { verdict } from './verdict';

/**
 * A country's flag in a ring that fills as its closest route is answered. The flag starts grey and
 * takes its colours as the answers come in; a tick once the route is answered.
 */
function Ring({
  country,
  small = false,
}: {
  country: Country & { total: number; left: number };
  /** Phones' summary: a smaller ring, no tick (the ring turns green). */
  small?: boolean;
}) {
  const share = country.total ? (country.total - country.left) / country.total : 0;
  const done = country.left === 0;
  return (
    <span
      aria-hidden="true"
      className={`relative flex-none rounded-full p-0.5 ${small ? 'size-7 shadow-[0_0_0_2px_var(--canvas)]' : 'size-8 lg:size-10'}`}
      style={{
        background: done
          ? 'var(--good)'
          : `conic-gradient(var(--primary) ${String(share * 100)}%, var(--track) 0)`,
      }}
    >
      <span
        className="block size-full overflow-hidden rounded-full bg-surface p-0.5"
        style={{ filter: `grayscale(${String(1 - share)})`, opacity: 0.55 + share * 0.45 }}
      >
        <span className="block size-full overflow-hidden rounded-full">
          <Flag code={country.code} name={country.name} />
        </span>
      </span>
      {done && !small && (
        <span className="absolute -end-1 -bottom-1 flex size-[18px] items-center justify-center rounded-full border border-surface bg-good text-surface">
          <Icon name="check" size={10} />
        </span>
      )}
    </span>
  );
}

/** The countries being checked as the person answers (beside the question; chips on phones). */
export function Rail({
  countries,
  peek,
}: {
  countries: (Country & { total: number; left: number })[];
  peek: ReactNode;
}) {
  const { t } = useTranslation('pathways');
  const f = useFormat();
  const { wide } = use(BarContext);
  if (!wide) {
    // Phones: one small line over the question (its first route shows above the buttons).
    const done = countries.filter((country) => country.left === 0).length;
    return (
      <p className="m-0 inline-flex min-h-9 items-center gap-2 self-start rounded-full bg-canvas py-1 ps-2.5 pe-3.5">
        <span aria-hidden="true" className="flex">
          {countries.map((country) => (
            <span key={country.id} className="-ms-1.5 flex first:ms-0">
              <Ring country={country} small />
            </span>
          ))}
        </span>
        <span className="text-label font-semibold text-text-2">
          {done
            ? t('rail.summary_done', { done: f.number(done), n: f.number(countries.length) })
            : t('rail.summary', { n: f.number(countries.length) })}
        </span>
      </p>
    );
  }
  return (
    <div className="flex flex-col">
      <h2 className="m-0 mb-2 text-label font-semibold text-text-2">{t('rail.title')}</h2>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {countries.map((country) => {
          const done = country.left === 0;
          return (
            <li
              key={country.id}
              className="flex flex-none items-center gap-3.5 rounded-full bg-canvas py-3.5 ps-1.5 pe-4"
            >
              <Ring country={country} />
              <span className="flex flex-col">
                <span className="text-base leading-5 font-semibold">{country.name}</span>
                <span className={`text-sm leading-5 ${done ? 'text-good' : 'text-text-2'}`}>
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
      <p className="m-0 mt-4 text-label text-text-2">{t('rail.note')}</p>
    </div>
  );
}

/** The first route, ready: a quiet note that opens beside the questions without stopping them. */
export function Peek({
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
      <span className="flex items-center gap-2 text-label font-semibold text-good">
        <Icon name="check" size={16} />
        {t('peek.title')}
      </span>
      <span className="mt-1 flex items-center gap-2 text-base leading-7 font-bold">
        <SmallFlag code={pathway.country.code} name={pathway.country.name} />
        {t('peek.route', { country: pathway.country.name, name: pathway.name })}
      </span>
      {result && <span className="text-sm text-text-2">{t(key(verdict(result).key))}</span>}
      <button
        type="button"
        onClick={onSee}
        className="inline-flex min-h-tap items-center gap-1.5 self-start text-body font-semibold text-good hover:underline"
      >
        {t('peek.see')}
        <QuizIcon name="forward" size={16} className="rtl:-scale-x-100" />
      </button>
    </div>
  );
}

/**
 * Phones: the first route, ready, as a quiet strip above the buttons (it never pushes the question
 * down). "See why" opens it.
 */
export function PeekStrip({
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
  const route = t('peek.route', { country: pathway.country.name, name: pathway.name });
  return (
    <div
      role="status"
      className="flex min-h-row animate-rise items-center gap-3 rounded-2xl bg-good-tint py-1.5 ps-3 pe-1.5"
    >
      <span
        aria-hidden="true"
        className="flex size-7 flex-none items-center justify-center rounded-full bg-good text-surface"
      >
        <Icon name="check" size={16} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-caption font-bold text-good">{t('peek.title')}</span>
        <span className="truncate text-small font-bold">
          {result ? t('peek.strip', { route, verdict: t(key(verdict(result).key)) }) : route}
        </span>
      </span>
      <button
        type="button"
        onClick={onSee}
        className="min-h-tap flex-none rounded-xl bg-surface px-3.5 text-small font-bold text-good"
      >
        {t('peek.see')}
      </button>
    </div>
  );
}
