import { useTranslation } from 'react-i18next';
import { useFormat } from '@/lib/i18n/useFormat';
import type { ApplicationsData } from '../api';
import { placeOf, type Place } from '../groups';

/** One segment per application, in this order, then the contract's unused applications. */
const SEGMENTS: { place: Place; fill: string }[] = [
  { place: 'decided', fill: 'bg-live' },
  { place: 'sent', fill: 'bg-hero-info' },
  { place: 'preparing', fill: 'bg-hero-current' },
  { place: 'awaiting', fill: 'bg-hero-accent' },
  // Rejected suggestions still count against the contract, as Django counts them.
  { place: 'declined', fill: 'bg-on-hero-3' },
];

/** Dark card: how many of the contract's applications are used, and where each one is. */
export function QuotaCard({ data }: { data: ApplicationsData }) {
  const { t } = useTranslation('applications');
  const { t: th } = useTranslation('home');
  const f = useFormat();
  const { used, total } = data.applies;
  const count = (place: Place) => data.results.filter((item) => placeOf(item) === place).length;
  const counts = SEGMENTS.map((segment) => ({ ...segment, n: count(segment.place) }));
  const free = Math.max(0, total - used);
  // Segments only while they stay readable; a bigger contract keeps the legend alone.
  const bar = used + free <= 40;

  return (
    <section
      aria-labelledby="apps-quota"
      className="flex flex-col gap-4 rounded-[24px] bg-hero px-5 py-[22px] text-on-hero shadow-hero lg:gap-5 lg:rounded-[32px] lg:px-9 lg:py-8"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-[13px] font-bold text-hero-current">{t('quota.label')}</span>
          <h2
            id="apps-quota"
            className="m-0 font-display text-xl leading-snug font-bold lg:text-[28px]"
          >
            {total > 0
              ? t('quota.title', { used: f.number(used), total: f.number(total) })
              : t('quota.titleNoTotal', { used: f.number(used) })}
          </h2>
        </div>
        <span className="inline-flex h-9 items-center gap-1.5 rounded-[14px] bg-hero-raised px-3.5 text-[13px] text-on-hero-2">
          {t('quota.stage')}
          <span className="font-semibold text-on-hero">{th(`stage.${data.stage}.status`)}</span>
        </span>
      </div>

      {bar && (
        <div aria-hidden="true" className="flex gap-[3px] lg:gap-[5px]">
          {counts.flatMap(({ place, fill, n }) =>
            Array.from({ length: n }, (_, index) => (
              <span
                key={`${place}-${String(index)}`}
                className={`h-2 flex-1 rounded-full lg:h-2.5 ${fill}`}
              />
            )),
          )}
          {Array.from({ length: free }, (_, index) => (
            <span
              key={`free-${String(index)}`}
              className="h-2 flex-1 rounded-full bg-hero-line lg:h-2.5"
            />
          ))}
        </div>
      )}

      <ul
        aria-label={t('quota.legend')}
        className="m-0 flex list-none flex-wrap gap-x-5 gap-y-1.5 p-0 text-[13px] text-on-hero-2"
      >
        {counts
          .filter(({ n }) => n > 0)
          .map(({ place, fill, n }) => (
            <li key={place} className="flex items-center gap-1.5">
              <span aria-hidden="true" className={`size-2.5 rounded-full ${fill}`} />
              {t(`quota.${place}`, { n: f.number(n) })}
            </li>
          ))}
        {free > 0 && (
          <li className="flex items-center gap-1.5">
            <span aria-hidden="true" className="size-2.5 rounded-full bg-hero-line" />
            {t('quota.free', { n: f.number(free) })}
          </li>
        )}
      </ul>
    </section>
  );
}
