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

/** A route checked while the questions go on, with how it fits (once Django has answered). */
export interface FoundRoute {
  pathway: FinderPathway;
  result: PathwayResult | undefined;
}

const TINT = { good: 'bg-good-tint', warn: 'bg-warn-tint', neutral: 'bg-canvas' } as const;
const DOT = {
  good: 'bg-good text-surface',
  warn: 'bg-warn text-surface',
  neutral: 'bg-surface text-text-2',
} as const;

/** One found route: its fit's colour, "new" or its verdict, the country and name. Opens it. */
function FoundCard({
  route,
  fresh,
  onOpen,
  className = '',
}: {
  route: FoundRoute;
  fresh: boolean;
  onOpen: () => void;
  className?: string;
}) {
  const { t } = useTranslation('pathways');
  const { pathway, result } = route;
  const fit = result ? verdict(result) : null;
  const tone = (fit?.tone ?? 'neutral') as keyof typeof TINT;
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`flex min-h-row animate-rise items-center gap-3 rounded-2xl py-2 ps-2.5 pe-3 text-start ${TINT[tone]} ${className}`}
    >
      <span
        aria-hidden="true"
        className={`flex size-8 flex-none items-center justify-center rounded-full ${DOT[tone]}`}
      >
        {tone === 'good' ? (
          <Icon name="check" size={16} />
        ) : (
          <SmallFlag code={pathway.country.code} name={pathway.country.name} />
        )}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span
          className={`text-caption font-bold ${tone === 'good' ? 'text-good' : tone === 'warn' ? 'text-warn' : 'text-text-2'}`}
        >
          {fit
            ? fresh
              ? t('found.new', { verdict: t(key(fit.key)) })
              : t(key(fit.key))
            : t('found.checking')}
        </span>
        <span className="truncate text-small font-bold">
          {t('peek.route', { country: pathway.country.name, name: pathway.name })}
        </span>
      </span>
      <QuizIcon name="forward" size={16} className="flex-none text-text-2 rtl:-scale-x-100" />
    </button>
  );
}

/**
 * The routes answered so far, newest first: they arrive one by one as the questions go on and never
 * stop them. Phones: a row that slides sideways above the buttons (the next card peeks in at the
 * edge). Wide screens: a list beside the questions. Each opens its route.
 */
export function FoundRoutes({
  routes,
  onOpen,
}: {
  routes: FoundRoute[];
  onOpen: (id: number) => void;
}) {
  const { t } = useTranslation('pathways');
  const f = useFormat();
  const { wide } = use(BarContext);
  if (!routes.length) return null;
  const fits = routes.filter((route) => route.result?.eligible).length;
  const title = fits
    ? t('found.title', { count: fits, n: f.number(fits) })
    : t('found.checked', { count: routes.length, n: f.number(routes.length) });
  if (wide)
    return (
      <section role="status" className="mt-4 flex flex-col gap-2">
        <h2 className="m-0 text-label font-semibold text-text-2">{title}</h2>
        {routes.map((route, index) => (
          <FoundCard
            key={route.pathway.id}
            route={route}
            fresh={index === 0 && routes.length > 1}
            onOpen={() => onOpen(route.pathway.id)}
          />
        ))}
      </section>
    );
  const single = routes.length === 1;
  return (
    <section role="status" aria-label={title} className="-mx-4 flex flex-col">
      <ul
        className="m-0 flex snap-x snap-mandatory [scrollbar-width:none] list-none gap-2 overflow-x-auto overscroll-x-contain px-4 py-0.5 [&::-webkit-scrollbar]:hidden"
        style={{ scrollPaddingInline: '1rem' }}
      >
        {routes.map((route, index) => (
          <li
            key={route.pathway.id}
            className={`flex snap-start ${single ? 'w-full' : 'w-[84%] flex-none'}`}
          >
            <FoundCard
              route={route}
              fresh={index === 0 && !single}
              className="w-full"
              onOpen={() => onOpen(route.pathway.id)}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
