import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { daysUntil } from '@/lib/dates';
import { useFormat } from '@/lib/i18n/useFormat';
import type { BoardItem } from '../api';
import { casePath } from '../paths';

/** Days left at which a deadline turns amber. */
export const URGENT_DAYS = 7;

/**
 * The dark "departures board" on top of Today (canvas V4/V5 supervisor): every application due in
 * the next 14 days, soonest first, with what still stands in its way.
 */
export function DeadlineBoard({ items }: { items: readonly BoardItem[] }) {
  const { t } = useTranslation('supervisor');
  const f = useFormat();

  return (
    <section
      aria-labelledby="deadline-board"
      className="flex flex-col gap-4 rounded-card-sm bg-hero p-5 text-on-hero shadow-hero lg:rounded-[32px] lg:px-9 lg:py-8"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="deadline-board" className="m-0 font-display text-xl font-bold">
          {t('today.board.title')}
        </h2>
        <span className="text-sm text-on-hero-2">{t('today.board.window')}</span>
      </div>

      {items.length === 0 ? (
        <p className="m-0 text-[15px] leading-7 text-on-hero-2">{t('today.board.empty')}</p>
      ) : (
        <ol className="m-0 flex list-none flex-col p-0">
          {items.map((item) => {
            const days = daysUntil(item.deadline);
            const urgent = days <= URGENT_DAYS && item.status !== 'submitted';
            return (
              <li
                key={item.application}
                className="flex flex-wrap items-center gap-x-5 gap-y-1.5 py-3.5 not-first:shadow-[inset_0_1px_0_var(--hero-line)]"
              >
                <span
                  className={`flex w-16 flex-none flex-col leading-none ${urgent ? 'text-hero-current' : ''}`}
                >
                  <span className="text-[28px] font-bold tabular-nums">{f.number(days)}</span>
                  <span className="mt-1 text-xs text-on-hero-2">{t('today.board.daysUnit')}</span>
                </span>
                <span className="flex min-w-0 flex-[1_1_220px] flex-col gap-0.5">
                  <span className="truncate text-base font-semibold">
                    <bdi>{item.university}</bdi>
                  </span>
                  <span className="truncate text-sm text-on-hero-2">
                    <bdi>{item.program}</bdi>
                  </span>
                </span>
                <Link
                  to={casePath(item.applicant.id, 'applications')}
                  className="min-w-0 flex-[1_1_140px] text-[15px] text-on-hero underline-offset-4 hover:underline"
                >
                  {item.applicant.name}
                </Link>
                <span
                  className={`flex-[1_1_160px] text-sm font-medium ${
                    urgent ? 'text-hero-current' : 'text-on-hero-2'
                  }`}
                >
                  {t(`today.board.status.${item.status}`)}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
