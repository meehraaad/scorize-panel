import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { ContactLogButton } from '@/components/sales/ContactLogButton';
import { Button } from '@/components/ui/Button';
import { buttonClass } from '@/components/ui/buttonStyles';
import { Chip, type ChipTone } from '@/components/ui/Chip';
import { Icon, type IconName } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { DayPlan } from '@/components/ui/DayPlan';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { addDays, toValue } from '@/lib/calendar';
import { useFormat } from '@/lib/i18n/useFormat';
import { useConfirmReceipt } from '@/lib/sales/api';
import { toast } from '@/lib/toast';
import { safeHref } from '@/lib/url';
import {
  AGENDA_FILTERS,
  FREE_MINUTES,
  dayAgendaOf,
  endOf,
  filterOf,
  type Agenda,
  type AgendaFilter,
  type AgendaItem,
} from '../agenda';
import { sellerDayQuery, type SellerCalendar } from '../api';
import type { Chosen } from '../consultationStatus';
import { EventDetails } from './EventDetails';
import { OwnerTag } from './OwnerTag';
import { FollowUpDialog } from './FollowUpDialog';
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
/** A card's title: its link or button stretches over the whole card. */
const cardTitle =
  'cursor-pointer text-start text-[15px] font-semibold outline-none after:absolute after:inset-0 after:rounded-2xl';

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
  // Days from today: 0 is today's whole plan; another day shows its calendar (timed follow-ups and
  // consultations) and how many tasks fall on it. The day's calendar also fills the popup a
  // consultation or follow-up opens (the consultations calendar's card).
  const [offset, setOffset] = useState(0);
  const [chosenKey, setChosenKey] = useState<string | null>(null);
  const [moving, setMoving] = useState<{ at: Date; lead: { id: number; name: string } } | null>(
    null,
  );
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const day = addDays(today, offset);
  const other = useQuery(sellerDayQuery(day));
  const shown =
    offset === 0 ? agenda : other.data ? dayAgendaOf(other.data) : { now: [], timed: [] };
  const dayTasks = other.data?.tasks.find((row) => row.day === toValue(day, false));
  const openTasks = offset !== 0 && dayTasks ? dayTasks.mine + dayTasks.requests : 0;
  const chosen = chosenKey && other.data ? chosenOf(other.data, chosenKey) : undefined;
  const opens = (item: AgendaItem) =>
    other.data && chosenOf(other.data, item.key) ? () => setChosenKey(item.key) : undefined;
  const title =
    offset === 0
      ? t('today.agenda.title')
      : offset === -1
        ? t('today.agenda.titleOf.yesterday')
        : offset === 1
          ? t('today.agenda.titleOf.tomorrow')
          : t('today.agenda.titleOf.other', { day: f.weekday(day) });
  const freeText = (minutes: number) =>
    minutes >= 60
      ? t('today.agenda.freeHours', { n: f.number(Math.round((minutes / 60) * 2) / 2) })
      : t('today.agenda.freeMinutes', { n: f.number(minutes) });
  const links = (filter: AgendaFilter) => {
    if (offset !== 0) return [];
    const showCalls = filter === 'all' || filter === 'calls';
    return [
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
  };

  const plan = (
    <DayPlan
      id="agenda-title"
      title={title}
      subtitle={
        offset === 0
          ? t('today.agenda.subtitle', { day: f.weekday(new Date(now)) })
          : t('today.agenda.otherSubtitle', { day: f.date(day) })
      }
      nav={
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={offset === 0}
            onClick={() => {
              setOffset(0);
              setChosenKey(null);
            }}
            className="min-h-11 rounded-full bg-surface px-4 text-sm font-semibold shadow-[inset_0_0_0_1px_var(--line-2)] hover:bg-canvas disabled:opacity-50"
          >
            {t('today.agenda.dayNav.today')}
          </button>
          <IconButton
            icon="chevronStart"
            aria-label={t('today.agenda.dayNav.previous')}
            onClick={() => {
              setOffset((value) => value - 1);
              setChosenKey(null);
            }}
          />
          <IconButton
            icon="chevronEnd"
            aria-label={t('today.agenda.dayNav.next')}
            onClick={() => {
              setOffset((value) => value + 1);
              setChosenKey(null);
            }}
          />
        </div>
      }
      today={offset === 0}
      loading={offset !== 0 && other.isPending ? <SkeletonRows rows={3} /> : undefined}
      due={shown.now}
      timed={shown.timed}
      keyOf={(item) => item.key}
      timeOf={(item) => item.at ?? now}
      endOf={endOf}
      renderItem={(item, due) => (
        <AgendaRow key={item.key} item={item} now={now} due={due} onOpen={opens(item)} />
      )}
      filters={{
        label: t('today.agenda.filter'),
        of: filterOf,
        options: AGENDA_FILTERS.map((value) => ({
          value,
          label: t(`today.agenda.filters.${value}`),
        })),
      }}
      nowTitle={t('today.agenda.now')}
      links={links}
      freeMinutes={FREE_MINUTES}
      renderFree={({ minutes }) => (
        <>
          <span className="flex-[1_1_220px] text-sm text-text-2">
            {t('today.agenda.free', { time: freeText(minutes) })}
          </span>
          <Link
            to={salesPath('leads')}
            className="inline-flex min-h-11 items-center text-sm font-semibold text-primary-text"
          >
            {t('today.agenda.freeLink')}
          </Link>
        </>
      )}
      empty={t(offset === 0 ? 'today.agenda.empty' : 'today.agenda.otherEmpty')}
      shown={NOW_SHOWN}
      now={now}
      footer={
        <>
          {openTasks > 0 && (
            <Link
              to={salesPath('tasks')}
              className="inline-flex min-h-11 items-center text-sm font-semibold text-primary-text"
            >
              {t('today.agenda.dayTasks', { n: f.number(openTasks) })}
            </Link>
          )}
          <Link
            to={salesPath('calendar')}
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
        </>
      }
    />
  );
  return (
    <>
      {plan}
      {chosen && other.data && (
        <DetailsPopup onClose={() => setChosenKey(null)}>
          <EventDetails
            chosen={chosen}
            type={
              chosen.kind === 'consultation'
                ? other.data.types.find((type) => type.id === chosen.item.type)
                : undefined
            }
            now={now}
            onClose={() => setChosenKey(null)}
            onMoveCall={(call) => {
              setChosenKey(null);
              setMoving({
                at: new Date(call.follow_up_at),
                lead: { id: call.lead, name: call.name },
              });
            }}
          />
        </DetailsPopup>
      )}
      {moving && (
        <FollowUpDialog open onClose={() => setMoving(null)} at={moving.at} lead={moving.lead} />
      )}
    </>
  );
}

/** The agenda key's event in the day's calendar (`consultation-12`, `call-7`). */
function chosenOf(day: SellerCalendar, key: string): Chosen | undefined {
  const [kind, id] = key.split('-');
  if (kind === 'consultation') {
    const item = day.consultations.find((row) => String(row.id) === id);
    return item && { kind, item };
  }
  if (kind === 'call') {
    const item = day.calls.find((row) => String(row.lead) === id);
    return item && { kind, item };
  }
  return undefined;
}

/** The calendar's event card as a centred popup (closes on Escape or a click outside). */
function DetailsPopup({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(event) => event.target === event.currentTarget && ref.current?.close()}
      className="m-auto w-[min(420px,calc(100vw-32px))] overflow-visible bg-transparent p-0 text-text backdrop:bg-black/40"
    >
      {children}
    </dialog>
  );
}

/** One row of the day: what kind it is, who or what, when, and its one main action. */
function AgendaRow({
  item,
  now,
  due = false,
  onOpen,
}: {
  item: AgendaItem;
  now: number;
  due?: boolean;
  /** Opens its calendar card (a consultation, a timed follow-up); without it, the card links. */
  onOpen?: (() => void) | undefined;
}) {
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
          to={customerPath(lead.customer)}
          meta={lead.reason}
          owner={lead.seller}
          when={<span className="text-danger">{f.timeAgo(lead.created_at)}</span>}
          action={
            <ContactLogButton
              customer={lead.customer}
              name={lead.name}
              start={{ channel: 'call' }}
              phone={lead.phone}
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
          to={customerPath(call.customer)}
          onOpen={onOpen}
          meta={call.reason}
          owner={call.seller}
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
              phone={call.phone}
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
      return (
        <Row
          tone={status === 'need' ? 'warn' : status === 'done' ? 'good' : 'primary'}
          icon="calendar"
          title={consultation.name}
          tag={t('today.agenda.tag.consultation')}
          to={customerPath(consultation.customer)}
          meta={t('today.agenda.consultationMeta', {
            range,
            type: consultation.type,
            mode: t(`mode.${consultation.mode}`),
          })}
          status={t(`today.agenda.status.${status}`)}
          owner={consultation.seller}
          done={status === 'done'}
          highlight={status === 'live' || status === 'upcoming'}
          onOpen={onOpen}
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
          to={
            person
              ? customerPath(person.id, task.action === 'message' ? 'message' : undefined)
              : salesPath('tasks')
          }
          meta={person ? [person.name, person.context].filter(Boolean).join(' · ') : ''}
          when={due && <span className="text-warn">{time(item.at)}</span>}
          action={
            person &&
            task.action === 'call' && (
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
          to={salesPath('tasks?view=requests')}
          meta={[t('today.agenda.requestFrom', { name: request.from.name }), request.person?.name]
            .filter(Boolean)
            .join(' · ')}
          when={
            <span className={due ? 'text-warn' : 'text-text-2'}>
              {t('today.agenda.due', { time: time(item.at) })}
            </span>
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
      to={customerPath(receipt.customer)}
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
            className="relative z-10 font-medium text-primary-text underline-offset-4 hover:underline"
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
  to,
  onOpen,
  meta,
  status,
  owner,
  when,
  action,
  done = false,
  highlight = false,
}: {
  tone: ChipTone;
  icon: IconName;
  title: string;
  tag: string;
  /** Where a click anywhere on the card goes (the person, or the task list). */
  to: string;
  /** Instead of following `to`, a click opens this (the calendar card popup). */
  onOpen?: (() => void) | undefined;
  meta: ReactNode;
  status?: string;
  /** Whose it is, on a sales manager's day. */
  owner?: string | null | undefined;
  when?: ReactNode;
  action?: ReactNode;
  done?: boolean;
  highlight?: boolean;
}) {
  return (
    <li
      className={`relative flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl p-3 transition-colors has-[[data-card]:focus-visible]:outline-2 has-[[data-card]:focus-visible]:outline-primary ${
        highlight
          ? 'bg-tint shadow-[inset_0_0_0_1.5px_var(--primary)]'
          : done
            ? 'bg-canvas opacity-80 hover:opacity-100'
            : 'bg-surface shadow-[inset_0_0_0_1px_var(--line-2)] hover:bg-canvas'
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
          {/* The title covers the whole card; the buttons sit above it. */}
          {onOpen ? (
            <button
              type="button"
              data-card=""
              onClick={onOpen}
              aria-haspopup="dialog"
              className={`${cardTitle} ${done ? 'text-text-2 line-through' : 'text-text'}`}
            >
              {title}
            </button>
          ) : (
            <Link
              to={to}
              data-card=""
              className={`${cardTitle} ${done ? 'text-text-2 line-through' : 'text-text'}`}
            >
              {title}
            </Link>
          )}
          <Chip tone={tone} small>
            {tag}
          </Chip>
          <OwnerTag seller={owner} />
        </span>
        {meta && <span className="text-[13px] leading-6 text-text-2">{meta}</span>}
        {status && <span className="text-xs font-semibold text-text-2">{status}</span>}
      </span>
      {when && <span className="text-[13px] font-semibold whitespace-nowrap">{when}</span>}
      {action && <span className="relative z-10 w-full flex-none sm:w-auto">{action}</span>}
    </li>
  );
}
