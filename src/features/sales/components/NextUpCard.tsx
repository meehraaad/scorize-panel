import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Icon } from '@/components/ui/Icon';
import { IconLink } from '@/components/ui/IconButton';
import { useFormat } from '@/lib/i18n/useFormat';
import { FIRST_CALL_TARGET_MINUTES, MESSAGE_CHANNELS, messageHref } from '@/lib/sales/api';
import { openContactLog, type ContactValues } from '@/lib/sales/contactDrafts';
import type { AgendaItem } from '../agenda';
import { useSalesFormat } from '../format';
import { customerPath } from '../paths';
import { ScoreChip } from './LeadChips';

/** The person the card puts first: a new lead, or a follow-up that is due. */
export type NextUp = Extract<AgendaItem, { kind: 'lead' | 'call' }>;

/** One click after the call: the contact log opens with this answer already chosen. */
const OUTCOMES = [
  { key: 'talked', values: { outcome: 'talked' } },
  { key: 'no_answer', values: { outcome: 'no_answer' } },
  { key: 'call_later', values: { outcome: 'call_later' } },
  { key: 'wrong_number', values: { outcome: 'wrong_number' } },
  { key: 'lost', values: { outcome: 'talked', stage: 'lost' } },
] as const satisfies readonly { key: string; values: Partial<ContactValues> }[];

const chip =
  'inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-sm font-medium text-on-hero shadow-[inset_0_0_0_1px_var(--hero-line)] hover:bg-hero-raised';

/**
 * "Your next step" (canvas "داشبورد امروز"): the one person to call now, why, the call button and
 * the result in one click. `position` / `total` count the urgent items; "next person" moves on.
 */
export function NextUpCard({
  item,
  position,
  total,
  onSkip,
}: {
  item: NextUp;
  position: number;
  total: number;
  onSkip: (() => void) | null;
}) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const s = useSalesFormat();
  const person = item.kind === 'lead' ? item.lead : item.call;
  const { customer, name, phone, score, reason } = person;

  const why =
    item.kind === 'lead'
      ? t('today.next.waiting', { time: f.timeAgo(item.lead.created_at) })
      : item.at !== null
        ? t('today.next.late', { time: f.time(new Date(item.at)) })
        : t('today.next.overdue', {
            due: s.due(item.call.follow_up_at, item.call.stage, true).text,
          });

  return (
    <section
      aria-labelledby="next-up-title"
      className="flex flex-col gap-5 rounded-card-sm bg-hero p-5 text-on-hero shadow-hero lg:rounded-[28px] lg:p-7"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2
          id="next-up-title"
          className="m-0 inline-flex items-center gap-2 text-sm font-bold text-hero-accent"
        >
          <span
            aria-hidden="true"
            className="size-2.5 animate-pulse rounded-full bg-hero-danger motion-reduce:animate-none"
          />
          {t('today.next.title')}
        </h2>
        <span className="text-sm text-on-hero-2">{why}</span>
        {item.kind === 'lead' && (
          <span className="text-sm text-on-hero-2">
            {t('today.next.goal', { n: f.number(FIRST_CALL_TARGET_MINUTES) })}
          </span>
        )}
        <span className="ms-auto text-sm text-on-hero-2">
          {t('today.next.position', { n: f.number(position), total: f.number(total) })}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-x-8 gap-y-5">
        <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-display text-2xl font-bold lg:text-[30px] lg:leading-tight">
              {name}
            </span>
            <ScoreChip score={score} />
          </div>
          {reason && <p className="m-0 text-[15px] leading-8 text-on-hero-2">{reason}</p>}
          {item.kind === 'lead' && (
            <span className="text-xs text-on-hero-3">
              {t('today.next.source', { source: t(`source.${item.lead.source}`) })}
            </span>
          )}
        </div>
        <div className="flex flex-[0_1_300px] flex-col gap-2.5">
          <button
            type="button"
            onClick={() => openContactLog(customer, name, { channel: 'call' })}
            aria-label={t('callName', { name })}
            className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-hero-accent px-5 text-base font-bold text-hero hover:brightness-105"
          >
            <Icon name="phone" size={20} />
            {t('callName', { name })}
          </button>
          <div className="flex items-center gap-1">
            <Link
              to={customerPath(customer)}
              aria-label={t('today.next.customerName', { name })}
              className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl px-4 text-sm font-semibold text-on-hero shadow-[inset_0_0_0_1px_var(--hero-line)] hover:bg-hero-raised"
            >
              {t('today.next.customer')}
            </Link>
            {MESSAGE_CHANNELS.map((channel) => (
              <IconLink
                key={channel}
                href={messageHref(channel, phone)}
                target="_blank"
                rel="noreferrer"
                icon={channel === 'sms' ? 'chat' : 'send'}
                aria-label={t('messageTo', { channel: t(`channel.${channel}`), name })}
                tone="inherit"
                className="text-on-hero hover:bg-hero-raised"
              />
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-4 shadow-[inset_0_1px_0_var(--hero-line)]">
        <span className="me-1 text-sm text-on-hero-2">{t('today.next.after')}</span>
        {OUTCOMES.map(({ key, values }) => (
          <button
            key={key}
            type="button"
            className={chip}
            aria-label={t('today.next.outcomeName', {
              outcome: t(`today.next.outcome.${key}`),
              name,
            })}
            onClick={() => openContactLog(customer, name, { channel: 'call' }, values)}
          >
            {key === 'talked' && <Icon name="check" size={16} />}
            {t(`today.next.outcome.${key}`)}
          </button>
        ))}
        {onSkip && (
          <button
            type="button"
            onClick={onSkip}
            className="ms-auto inline-flex min-h-11 items-center gap-1 rounded-full px-3 text-sm font-semibold text-hero-accent hover:bg-hero-raised"
          >
            {t('today.next.skip')}
            <Icon name="chevronEnd" size={16} />
          </button>
        )}
      </div>
    </section>
  );
}
