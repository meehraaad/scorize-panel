import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Icon } from '@/components/ui/Icon';
import { useFormat } from '@/lib/i18n/useFormat';
import { FIRST_CALL_TARGET_MINUTES } from '@/lib/sales/api';
import type { HotLead } from '../api';
import { customerPath } from '../paths';
import { useNow } from '../useNow';
import { ContactButtons } from './ContactButtons';
import { ScoreChip } from './LeadChips';

/** Leads shown before "show more": the oldest ones, which are the most urgent. */
const HOT_SHOWN = 3;

/** "Call now": new leads nobody has called, oldest first, each with a running wait timer. */
export function HotLeads({ leads }: { leads: HotLead[] }) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const now = useNow();
  const [all, setAll] = useState(false);
  const shown = all ? leads : leads.slice(0, HOT_SHOWN);
  const hidden = leads.length - HOT_SHOWN;

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
        {shown.map((lead) => {
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
      {hidden > 0 && (
        <div className="px-5 py-3 shadow-[inset_0_1px_0_var(--hero-line)] lg:px-9">
          <button
            type="button"
            aria-expanded={all}
            onClick={() => setAll(!all)}
            className="inline-flex h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold text-on-hero hover:bg-hero-raised"
          >
            {all ? t('today.hot.less') : t('today.hot.more', { n: f.number(hidden) })}
            <Icon name="chevronDown" size={16} className={all ? 'rotate-180' : ''} />
          </button>
        </div>
      )}
    </section>
  );
}
