import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { ContactLogButton } from '@/components/sales/ContactLogButton';
import { Button } from '@/components/ui/Button';
import { buttonClass, tabClass } from '@/components/ui/buttonStyles';
import { Card } from '@/components/ui/Card';
import { Chip, type ChipTone } from '@/components/ui/Chip';
import { Icon, type IconName } from '@/components/ui/Icon';
import { useFormat } from '@/lib/i18n/useFormat';
import { useConfirmReceipt } from '@/lib/sales/api';
import { toast } from '@/lib/toast';
import { safeHref } from '@/lib/url';
import {
  AGENDA_FILTERS,
  filterOf,
  timelineOf,
  type Agenda,
  type AgendaFilter,
  type AgendaItem,
} from '../agenda';
import { useSalesFormat } from '../format';
import { customerPath, salesPath } from '../paths';

/** Due-now rows shown before "show all". */
export const NOW_SHOWN = 5;

/** What the server has beyond the rows loaded: each becomes a link to the full list. */
export interface AgendaMore {
  hot: number;
  overdue: number;
  /** Older new leads nobody called (the call list's "new" bucket). */
  stale: number;
  tasks: boolean;
}

type ConsultationStatus = 'live' | 'need' | 'done' | 'upcoming';

const statusOf = (
  item: Extract<AgendaItem, { kind: 'consultation' }>,
  now: number,
): ConsultationStatus => {
  if (item.consultation.logged) return 'done';
  if (item.at <= now && now < item.end) return 'live';
  return item.at <= now ? 'need' : 'upcoming';
};

const TILE: Record<ChipTone, string> = {
  danger: 'bg-danger-tint text-danger',
  warn: 'bg-warn-tint text-warn',
  info: 'bg-info-tint text-info',
  primary: 'bg-tint text-primary-text',
  good: 'bg-good-tint text-good',
  neutral: 'bg-canvas text-text',
};

const small = 'h-11 w-full px-4 text-sm sm:w-32';

/**
 * Today's timetable (canvas "داشبورد امروز"): one list for new leads, follow-ups, consultations,
 * tasks, colleagues' requests and receipts. What is already due sits on top ("right now"), the
 * rest at its hour, with a line at the current time and a hint where a long free stretch is ahead.
 */
export function TodayAgenda({
  agenda,
  more,
  now,
}: {
  agenda: Agenda;
  more: AgendaMore;
  now: number;
}) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const [filter, setFilter] = useState<AgendaFilter>('all');
  const [expanded, setExpanded] = useState(false);

  const all = [...agenda.now, ...agenda.timed];
  const count = (key: AgendaFilter) =>
    key === 'all' ? all.length : all.filter((item) => filterOf(item) === key).length;
  const shows = (item: AgendaItem) => filter === 'all' || filterOf(item) === filter;
  const due = agenda.now.filter(shows);
  const timed = agenda.timed.filter(shows);
  const dueShown = expanded ? due : due.slice(0, NOW_SHOWN);
  const showCalls = filter === 'all' || filter === 'calls';
  const links = [
    showCalls &&
      more.hot > 0 && {
        key: 'hot',
        to: salesPath('leads?stage=new'),
        text: t('today.agenda.more.hot', { n: f.number(more.hot) }),
      },
    showCalls &&
      more.overdue > 0 && {
        key: 'overdue',
        to: salesPath('leads'),
        text: t('today.agenda.more.overdue', { n: f.number(more.overdue) }),
      },
    showCalls &&
      more.stale > 0 && {
        key: 'stale',
        to: salesPath('leads?stage=new'),
        text: t('today.agenda.more.stale', { n: f.number(more.stale) }),
      },
    (filter === 'all' || filter === 'tasks') &&
      more.tasks && { key: 'tasks', to: salesPath('tasks'), text: t('today.agenda.more.tasks') },
  ].filter((link) => link !== false);

  return (
    <Card aria-labelledby="agenda-title" className="flex min-w-0 flex-col gap-4 p-4 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 id="agenda-title" className="m-0 font-display text-xl font-bold">
            {t('today.agenda.title')}
          </h2>
          <span className="text-sm text-text-2">
            {t('today.agenda.subtitle', { day: f.weekday(new Date(now)) })}
          </span>
        </div>
        <div
          role="group"
          aria-label={t('today.agenda.filter')}
          className="flex flex-wrap gap-1 rounded-2xl bg-canvas p-1"
        >
          {AGENDA_FILTERS.map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={filter === key}
              onClick={() => setFilter(key)}
              className={`${tabClass(filter === key)} min-h-11 gap-1.5 px-3 text-sm`}
            >
              {t(`today.agenda.filters.${key}`)}
              <span className="tabular-nums">{f.number(count(key))}</span>
            </button>
          ))}
        </div>
      </div>

      {(due.length > 0 || links.length > 0) && (
        <section
          aria-labelledby="agenda-now"
          className="flex flex-col gap-2 rounded-2xl bg-danger-tint/50 p-3 lg:p-4"
        >
          <div className="flex flex-wrap items-baseline gap-x-2">
            <h3 id="agenda-now" className="m-0 text-sm font-bold text-danger">
              {t('today.agenda.now')}
            </h3>
            <span className="text-xs text-text-2">{t('today.agenda.nowNote')}</span>
          </div>
          {due.length > 0 && (
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {dueShown.map((item) => (
                <AgendaRow key={item.key} item={item} now={now} due />
              ))}
            </ul>
          )}
          {due.length > NOW_SHOWN && (
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => setExpanded((value) => !value)}
              className="min-h-11 self-start rounded-xl px-3 text-sm font-semibold text-primary-text hover:bg-surface"
            >
              {expanded
                ? t('today.agenda.showLess')
                : t('today.agenda.showAll', { n: f.number(due.length) })}
            </button>
          )}
          {links.length > 0 && (
            <ul className="m-0 flex list-none flex-wrap gap-x-4 p-0">
              {links.map((link) => (
                <li key={link.key}>
                  <Link
                    to={link.to}
                    className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-primary-text"
                  >
                    {link.text}
                    <Icon name="chevronEnd" size={14} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {all.length === 0 ? (
        <p className="m-0 py-6 text-center text-sm text-text-2">{t('today.agenda.empty')}</p>
      ) : due.length === 0 && timed.length === 0 && links.length === 0 ? (
        <p className="m-0 py-6 text-center text-sm text-text-2">
          {t('today.agenda.filteredEmpty')}
        </p>
      ) : (
        <Timeline items={timed} now={now} />
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-3 shadow-[inset_0_1px_0_var(--hair)]">
        <span className="flex-[1_1_240px] text-xs leading-6 text-text-2">
          {t('today.agenda.footer')}
        </span>
        <Link
          to={salesPath('leads/consultations')}
          className="inline-flex min-h-11 items-center text-sm font-medium text-primary-text"
        >
          {t('today.agenda.calendar')}
        </Link>
        <Link
          to={salesPath('tasks')}
          className="inline-flex min-h-11 items-center text-sm font-medium text-primary-text"
        >
          {t('today.agenda.tasks')}
        </Link>
      </div>
    </Card>
  );
}

function Timeline({ items, now }: { items: AgendaItem[]; now: number }) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const freeText = (minutes: number) =>
    minutes >= 60
      ? t('today.agenda.freeHours', { n: f.number(Math.round((minutes / 60) * 2) / 2) })
      : t('today.agenda.freeMinutes', { n: f.number(minutes) });
  return (
    <ol className="m-0 flex list-none flex-col p-0">
      {timelineOf(items, now).map((row) => {
        if (row.kind === 'now')
          return (
            <li
              key="now"
              aria-label={t('today.agenda.nowLine', { time: f.time(new Date(now)) })}
              className="flex items-center gap-3 py-2"
            >
              <span className="w-14 flex-none text-xs font-bold text-danger tabular-nums">
                {f.time(new Date(now))}
              </span>
              <span aria-hidden="true" className="relative h-0.5 flex-1 rounded-full bg-danger">
                <span className="absolute -start-1 -top-1 size-2.5 rounded-full bg-danger" />
              </span>
              <span aria-hidden="true" className="text-xs font-bold text-danger">
                {t('today.agenda.nowShort')}
              </span>
            </li>
          );
        if (row.kind === 'free')
          return (
            <li key={`free-${String(row.from)}`} className="flex gap-3 py-1.5">
              <span className="w-14 flex-none" />
              <span className="flex flex-1 flex-wrap items-center gap-x-3 rounded-2xl border border-dashed border-line-2 px-4 py-1.5">
                <span className="flex-[1_1_220px] text-sm text-text-2">
                  {t('today.agenda.free', { time: freeText(row.minutes) })}
                </span>
                <Link
                  to={salesPath('leads')}
                  className="inline-flex min-h-11 items-center text-sm font-semibold text-primary-text"
                >
                  {t('today.agenda.freeLink')}
                </Link>
              </span>
            </li>
          );
        return (
          <li key={row.item.key} className="flex gap-3 py-1.5">
            <span className="w-14 flex-none pt-3.5 text-sm font-semibold text-text-2 tabular-nums">
              {f.time(new Date(row.item.at ?? now))}
            </span>
            <ul className="m-0 min-w-0 flex-1 list-none p-0">
              <AgendaRow item={row.item} now={now} />
            </ul>
          </li>
        );
      })}
    </ol>
  );
}

/** One row of the day: what kind it is, who or what, when, and its one main action. */
function AgendaRow({ item, now, due = false }: { item: AgendaItem; now: number; due?: boolean }) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const s = useSalesFormat();
  const time = (at: number) => f.time(new Date(at));

  switch (item.kind) {
    case 'lead': {
      const { lead } = item;
      return (
        <Row
          tone="danger"
          icon="phone"
          title={lead.name}
          tag={t('today.agenda.tag.lead')}
          meta={lead.reason}
          when={<span className="text-danger">{f.timeAgo(lead.created_at)}</span>}
          action={
            <ContactLogButton
              customer={lead.customer}
              name={lead.name}
              start={{ channel: 'call' }}
              aria-label={t('callName', { name: lead.name })}
              className={buttonClass('primary', small)}
            >
              <Icon name="phone" size={16} />
              {t('call')}
            </ContactLogButton>
          }
        />
      );
    }
    case 'call': {
      const { call, at } = item;
      const late = at === null || at <= now;
      return (
        <Row
          tone={late ? 'warn' : 'neutral'}
          icon="phone"
          title={call.name}
          tag={
            at === null
              ? t('today.agenda.tag.overdue')
              : late
                ? t('today.agenda.tag.late', { time: time(at) })
                : t('today.agenda.tag.call')
          }
          meta={call.reason}
          when={
            due && (
              <span className="text-warn">
                {at === null ? s.due(call.follow_up_at, call.stage, true).text : time(at)}
              </span>
            )
          }
          action={
            <ContactLogButton
              customer={call.customer}
              name={call.name}
              start={{ channel: 'call' }}
              aria-label={t('callName', { name: call.name })}
              className={buttonClass(late ? 'primary' : 'outline', small)}
            >
              <Icon name="phone" size={16} />
              {t('call')}
            </ContactLogButton>
          }
        />
      );
    }
    case 'consultation': {
      const { consultation } = item;
      const status = statusOf(item, now);
      const range = t('today.agenda.range', { from: time(item.at), to: time(item.end) });
      const session = {
        title: consultation.type,
        starts_at: consultation.starts_at,
        minutes: consultation.minutes,
        mode: consultation.mode,
      };
      return (
        <Row
          tone={status === 'need' ? 'warn' : status === 'done' ? 'good' : 'primary'}
          icon="calendar"
          title={consultation.name}
          tag={t('today.agenda.tag.consultation')}
          meta={t('today.agenda.consultationMeta', {
            range,
            type: consultation.type,
            mode: t(`mode.${consultation.mode}`),
          })}
          status={t(`today.agenda.status.${status}`)}
          done={status === 'done'}
          highlight={status === 'live' || status === 'upcoming'}
          action={
            status === 'need' || status === 'live' ? (
              <ContactLogButton
                customer={consultation.customer}
                name={consultation.name}
                start={{ channel: 'meeting', reservation: consultation.id, session }}
                aria-label={t('today.agenda.logName', { name: consultation.name })}
                className={buttonClass('primary', small)}
              >
                {t('today.agenda.log')}
              </ContactLogButton>
            ) : status === 'upcoming' && consultation.meeting_url ? (
              <a
                href={safeHref(consultation.meeting_url)}
                target="_blank"
                rel="noreferrer"
                aria-label={t('today.agenda.joinName', { name: consultation.name })}
                className={buttonClass('primary', small)}
              >
                {t('today.agenda.join')}
              </a>
            ) : (
              <Link
                to={customerPath(consultation.customer)}
                aria-label={t('today.consultations.prepareName', { name: consultation.name })}
                className={buttonClass('outline', small)}
              >
                {t('today.consultations.prepare')}
              </Link>
            )
          }
        />
      );
    }
    case 'task': {
      const { task } = item;
      const person = task.person;
      return (
        <Row
          tone="good"
          icon="check"
          title={task.text}
          tag={t(
            task.source === 'system' ? 'today.agenda.tag.taskSystem' : 'today.agenda.tag.task',
          )}
          meta={person ? [person.name, person.context].filter(Boolean).join(' · ') : ''}
          when={due && <span className="text-warn">{time(item.at)}</span>}
          action={
            person && task.action === 'call' ? (
              <ContactLogButton
                customer={person.id}
                name={person.name}
                start={{ channel: 'call' }}
                aria-label={t('callName', { name: person.name })}
                className={buttonClass(due ? 'primary' : 'outline', small)}
              >
                <Icon name="phone" size={16} />
                {t('call')}
              </ContactLogButton>
            ) : (
              <Link
                to={
                  person
                    ? customerPath(person.id, task.action === 'message' ? 'message' : undefined)
                    : salesPath('tasks')
                }
                aria-label={t('today.agenda.openName', { text: task.text })}
                className={buttonClass('outline', small)}
              >
                {t('today.agenda.open')}
              </Link>
            )
          }
        />
      );
    }
    case 'request': {
      const { request } = item;
      return (
        <Row
          tone="good"
          icon="chat"
          title={request.text}
          tag={t('today.agenda.tag.request')}
          meta={[t('today.agenda.requestFrom', { name: request.from.name }), request.person?.name]
            .filter(Boolean)
            .join(' · ')}
          when={
            <span className={due ? 'text-warn' : 'text-text-2'}>
              {t('today.agenda.due', { time: time(item.at) })}
            </span>
          }
          action={
            <Link
              to={salesPath('tasks?view=requests')}
              aria-label={t('today.agenda.openName', { text: request.text })}
              className={buttonClass('outline', small)}
            >
              {t('today.agenda.open')}
            </Link>
          }
        />
      );
    }
    case 'receipt':
      return <ReceiptRow item={item} />;
  }
}

function ReceiptRow({ item }: { item: Extract<AgendaItem, { kind: 'receipt' }> }) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const s = useSalesFormat();
  const confirm = useConfirmReceipt();
  const { receipt } = item;
  return (
    <Row
      tone="info"
      icon="card"
      title={receipt.name}
      tag={t('today.agenda.tag.receipt')}
      meta={
        <>
          {t('today.agenda.receipt', { amount: s.toman(receipt.amount), what: receipt.what })}
          {' · '}
          {t(`today.receipts.method.${receipt.method}`)}
          {' · '}
          <a
            href={safeHref(receipt.receipt_url)}
            target="_blank"
            rel="noreferrer"
            aria-label={t('today.receipts.viewName', { name: receipt.name })}
            className="font-medium text-primary-text underline-offset-4 hover:underline"
          >
            {t('today.receipts.view')}
          </a>
        </>
      }
      when={<span className="text-info">{f.timeAgo(receipt.uploaded_at)}</span>}
      action={
        <Button
          variant="outline"
          className={small}
          aria-label={t('today.receipts.confirmName', { name: receipt.name })}
          disabled={confirm.isPending}
          onClick={() =>
            confirm.mutate(
              { customer: receipt.customer, payment: receipt.payment },
              {
                onSuccess: () =>
                  toast.success(t('today.receipts.confirmed', { name: receipt.name })),
                onError: () => toast.error(t('today.receipts.error')),
              },
            )
          }
        >
          <Icon name="check" size={16} />
          {t('today.receipts.confirm')}
        </Button>
      }
    />
  );
}

function Row({
  tone,
  icon,
  title,
  tag,
  meta,
  status,
  when,
  action,
  done = false,
  highlight = false,
}: {
  tone: ChipTone;
  icon: IconName;
  title: string;
  tag: string;
  meta: ReactNode;
  status?: string;
  when?: ReactNode;
  action: ReactNode;
  done?: boolean;
  highlight?: boolean;
}) {
  return (
    <li
      className={`flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl p-3 ${
        highlight
          ? 'bg-tint shadow-[inset_0_0_0_1.5px_var(--primary)]'
          : done
            ? 'bg-canvas opacity-80'
            : 'bg-surface shadow-[inset_0_0_0_1px_var(--line-2)]'
      }`}
    >
      <span
        aria-hidden="true"
        className={`flex size-10 flex-none items-center justify-center rounded-icon ${TILE[tone]}`}
      >
        <Icon name={done ? 'check' : icon} size={18} />
      </span>
      <span className="flex min-w-0 flex-[1_1_240px] flex-col gap-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className={`text-[15px] font-semibold ${done ? 'text-text-2 line-through' : ''}`}>
            {title}
          </span>
          <Chip tone={tone} small>
            {tag}
          </Chip>
        </span>
        {meta && <span className="text-[13px] leading-6 text-text-2">{meta}</span>}
        {status && <span className="text-xs font-semibold text-text-2">{status}</span>}
      </span>
      {when && <span className="text-[13px] font-semibold whitespace-nowrap">{when}</span>}
      <span className="w-full flex-none sm:w-auto">{action}</span>
    </li>
  );
}
