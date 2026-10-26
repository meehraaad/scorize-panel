import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Pager } from '@/components/ui/Pager';
import { useFormat } from '@/lib/i18n/useFormat';
import { FIRST_CALL_TARGET_MINUTES } from '@/lib/sales/api';
import type { HotLead } from '../api';
import { customerPath } from '../paths';
import { useNow } from '../useNow';
import { ContactButtons } from './ContactButtons';
import { ScoreChip } from './LeadChips';

/** Leads per page: the first page holds the oldest ones, which are the most urgent. */
export const HOT_PAGE = 3;

/**
 * "Call now": new leads nobody has called, oldest first, each with a running wait timer, a page
 * at a time. `leads` is the page; `from` the position of its first lead in the whole list.
 */
export function HotLeads({
  leads,
  from,
  total,
  page,
  pages,
  onPage,
}: {
  leads: HotLead[];
  from: number;
  total: number;
  page: number;
  pages: number;
  onPage: (page: number) => void;
}) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const now = useNow();

  const clock = (since: string) => {
    const seconds = Math.max(0, Math.floor((now - new Date(since).getTime()) / 1000));
    const minutes = Math.floor(seconds / 60);
    const pad = (value: number) => f.digits(String(value).padStart(2, '0'));
    return {
      text: `${pad(minutes)}:${pad(seconds % 60)}`,
      late: minutes >= FIRST_CALL_TARGET_MINUTES,
    };
  };

  return (
    <section
      aria-labelledby="hot-title"
      className="overflow-hidden rounded-card-sm bg-hero text-on-hero shadow-hero lg:rounded-[32px]"
    >
      <div className="flex flex-wrap items-end justify-between gap-3 px-5 pt-5 pb-3 lg:px-9 lg:pt-7">
        <div className="flex flex-col gap-2">
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-hero-current">
            <span
              aria-hidden="true"
              className="size-2 animate-pulse rounded-full bg-hero-current"
            />
            {t('today.hot.eyebrow')}
          </span>
          <h2 id="hot-title" className="m-0 font-display text-xl font-bold lg:text-2xl">
            {t('today.hot.title')}
          </h2>
        </div>
        <span className="text-sm text-on-hero-2">
          {t('today.hot.goal', { n: f.number(FIRST_CALL_TARGET_MINUTES) })}
        </span>
      </div>
      <ul className="m-0 list-none p-0">
        {leads.map((lead) => {
          const timer = clock(lead.created_at);
          return (
            <li
              key={lead.lead}
              className="flex flex-wrap items-center gap-x-6 gap-y-3 px-5 py-4 shadow-[inset_0_1px_0_var(--hero-line)] lg:flex-nowrap lg:px-9 lg:py-5"
            >
              <div className="flex w-20 flex-none flex-col">
                <span
                  dir="ltr"
                  role="timer"
                  aria-label={t('today.hot.waitingFor', { time: f.timeAgo(lead.created_at) })}
                  className={`text-start text-2xl font-bold tabular-nums ${timer.late ? 'text-hero-current' : 'text-on-hero'}`}
                >
                  {timer.text}
                </span>
                <span aria-hidden="true" className="text-xs text-on-hero-2">
                  {t('today.hot.waiting')}
                </span>
              </div>
              <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-1.5">
                <div className="flex flex-wrap items-center gap-2.5">
                  <Link
                    to={customerPath(lead.customer)}
                    className="text-[17px] font-bold text-on-hero hover:underline"
                  >
                    {lead.name}
                  </Link>
                  <ScoreChip score={lead.score} />
                </div>
                <span className="text-sm leading-7 text-on-hero-2">{lead.reason}</span>
                <span className="text-xs text-on-hero-3">
                  {t('today.hot.source', { source: t(`source.${lead.source}`) })}
                </span>
              </div>
              <ContactButtons customer={lead.customer} name={lead.name} phone={lead.phone} onHero />
            </li>
          );
        })}
      </ul>
      {pages > 1 && (
        <Pager
          onHero
          status={t('today.hot.pager', {
            from: f.number(from + 1),
            to: f.number(from + leads.length),
            total: f.number(total),
          })}
          page={page}
          pages={pages}
          onPage={onPage}
        />
      )}
    </section>
  );
}
