import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { ContactLogButton } from '@/components/sales/ContactLogButton';
import { buttonClass, iconButtonClass } from '@/components/ui/buttonStyles';
import { Card } from '@/components/ui/Card';
import { Chip, type ChipTone } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import { useFormat } from '@/lib/i18n/useFormat';
import { useDisplayName } from '@/lib/i18n/useDisplayName';
import { messageHref } from '@/lib/sales/api';
import { useCallHref } from '@/lib/sales/dial';
import { formatPhone } from '@/lib/site';
import { safeHref } from '@/lib/url';
import type { Consultation } from '../api';
import { customerPath } from '../paths';
import { AssignSeller } from './AssignSeller';

const SOON_MINUTES = 30;

type Status = 'need' | 'done' | 'soon' | 'upcoming';
const STATUS_TONE: Record<Status, ChipTone> = {
  need: 'warn',
  done: 'good',
  soon: 'primary',
  upcoming: 'info',
};

const statusOf = (item: Consultation, now: number): Status => {
  const starts = new Date(item.starts_at).getTime();
  if (starts <= now) return item.logged ? 'done' : 'need';
  return starts - now <= SOON_MINUTES * 60_000 ? 'soon' : 'upcoming';
};

const dayKey = (value: string) => new Date(value).toDateString();

/**
 * Paid consultations by day, one card a day: time, customer, type, status and the next action;
 * past ones without a logged session stand out. With `sellers` (a sales manager), each row has
 * the menu that gives it to a seller, and those nobody holds stand out.
 */
export function ConsultationDays({
  items,
  sellers,
  empty,
}: {
  items: readonly Consultation[];
  /** A manager's team, for the consultant menu; empty or absent: a seller's own list. */
  sellers?: readonly { id: number; name: string }[] | undefined;
  empty: string;
}) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  // Read once: the statuses don't need to change while the page is open.
  const [now] = useState(() => Date.now());

  const days = new Map<string, Consultation[]>();
  for (const item of items) {
    const key = dayKey(item.starts_at);
    days.set(key, [...(days.get(key) ?? []), item]);
  }
  if (days.size === 0) return <EmptyState variant="card">{empty}</EmptyState>;

  return [...days.values()].map((rows) => {
    const first = rows[0]?.starts_at ?? '';
    const id = `day-${dayKey(first).replace(/\s/g, '-')}`;
    const open = sellers?.length ? rows.filter((row) => row.seller_id === null).length : 0;
    return (
      <Card key={id} aria-labelledby={id}>
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-5 pt-5 pb-2 lg:px-8 lg:pt-6">
          <h2 id={id} className="m-0 font-display text-lg font-bold">
            {f.weekday(first)}
          </h2>
          <span className="text-sm text-text-2">
            {t('consultations.count', { n: f.number(rows.length) })}
            {open > 0 && (
              <span className="font-semibold text-warn">
                {' · '}
                {t('consultations.openCount', { n: f.number(open) })}
              </span>
            )}
          </span>
        </div>
        <ul className="m-0 list-none p-0">
          {rows.map((item) => (
            <ConsultationRow
              key={item.id}
              item={item}
              status={statusOf(item, now)}
              sellers={sellers?.length ? sellers : undefined}
            />
          ))}
        </ul>
      </Card>
    );
  });
}

function ConsultationRow({
  item,
  status,
  sellers,
}: {
  item: Consultation;
  status: Status;
  sellers: readonly { id: number; name: string }[] | undefined;
}) {
  const { t } = useTranslation('sales');
  const named = useDisplayName();
  const f = useFormat();
  const action = (label: string) =>
    t('consultations.actionsFor', { action: label, name: named(item.name) });
  const callHref = useCallHref(item.phone);
  const reminder = t('consultations.remindText', {
    name: item.name,
    type: item.type.name,
    when: `${f.weekday(item.starts_at)} ${f.time(item.starts_at)}`,
  });
  return (
    <li
      className={`flex flex-wrap items-center gap-x-5 gap-y-3 px-5 py-4 shadow-[inset_0_1px_0_var(--hair)] lg:flex-nowrap lg:px-8 ${status === 'need' ? 'bg-row-highlight' : ''}`}
    >
      <span className="flex w-14 flex-none flex-col">
        <span
          className={`text-lg font-bold tabular-nums ${status === 'need' ? 'text-urgent' : 'text-text'}`}
        >
          {f.time(item.starts_at)}
        </span>
        {item.minutes !== null && (
          <span className="text-xs text-text-2">
            {t('consultations.minutes', { n: f.number(item.minutes) })}
          </span>
        )}
      </span>
      <span className="flex min-w-0 flex-[1_1_220px] flex-col gap-1">
        <Link
          to={customerPath(item.customer)}
          className="text-base font-semibold text-text hover:underline"
        >
          {named(item.name)}
        </Link>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-text-2">
          <span>{item.type.name}</span>
          <Chip tone={item.mode === 'in_person' ? 'primary' : 'neutral'} small>
            {t(`mode.${item.mode}`)}
          </Chip>
          {sellers && item.phone && (
            <span dir="ltr" className="tabular-nums">
              {formatPhone(item.phone)}
            </span>
          )}
        </span>
        {!sellers && item.seller !== undefined && (
          <span className={`text-sm ${item.seller ? 'text-text-2' : 'font-semibold text-warn'}`}>
            {item.seller
              ? t('consultationCalendar.seller', { name: item.seller })
              : t('consultationCalendar.noSeller')}
          </span>
        )}
      </span>
      <span className="flex flex-wrap items-center gap-1.5">
        <Chip tone={STATUS_TONE[status]} small>
          {t(`consultations.status.${status}`)}
        </Chip>
        {item.arrived_at && (
          <Chip tone="good" small>
            {t('consultations.arrived', { time: f.time(item.arrived_at) })}
          </Chip>
        )}
      </span>
      {sellers && (
        <span className="lg:w-52 lg:flex-none">
          <AssignSeller item={item} sellers={sellers} hideLabel />
        </span>
      )}
      <span className="flex flex-wrap gap-2">
        {item.mode === 'online' && item.phone && status !== 'done' && (
          <a
            href={callHref}
            aria-label={t('callName', { name: named(item.name) })}
            className={iconButtonClass('outline')}
          >
            <Icon name="phone" size={20} />
          </a>
        )}
        {(status === 'need' || status === 'soon') && (
          <ContactLogButton
            customer={item.customer}
            name={named(item.name)}
            start={{
              channel: 'meeting',
              reservation: item.id,
              session: {
                title: item.type.name,
                starts_at: item.starts_at,
                minutes: item.minutes,
                mode: item.mode,
              },
            }}
            aria-label={action(t('consultations.log'))}
            className={buttonClass('primary', 'h-11 px-4 text-sm')}
          >
            {t('consultations.log')}
          </ContactLogButton>
        )}
        {status === 'upcoming' && !sellers && (
          <a
            href={messageHref('whatsapp', item.phone, reminder)}
            target="_blank"
            rel="noreferrer"
            aria-label={action(t('consultations.remind'))}
            className={buttonClass('outline', 'h-11 px-4 text-sm')}
          >
            {t('consultations.remind')}
          </a>
        )}
        {item.meeting_url && (
          <a
            href={safeHref(item.meeting_url)}
            target="_blank"
            rel="noreferrer"
            aria-label={action(t('consultations.link'))}
            className={buttonClass('outline', 'h-11 px-4 text-sm')}
          >
            {t('consultations.link')}
          </a>
        )}
      </span>
    </li>
  );
}
