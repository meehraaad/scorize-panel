import { useQuery } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { ContactLogButton } from '@/components/sales/ContactLogButton';
import { buttonClass } from '@/components/ui/buttonStyles';
import { Card } from '@/components/ui/Card';
import { TogglePill } from '@/components/ui/Choices';
import { EventCalendar, type CalendarEvent, type EventLook } from '@/components/ui/EventCalendar';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { MiniMonth } from '@/components/ui/MiniMonth';
import { addDays, eventColor, sameDay, toCalendar, weekOf, weekStart } from '@/lib/calendar';
import { useCalendar } from '@/lib/i18n/useCalendar';
import { useFormat } from '@/lib/i18n/useFormat';
import { messageHref } from '@/lib/sales/api';
import { formatPhone } from '@/lib/site';
import { toast } from '@/lib/toast';
import {
  sellerCalendarQuery,
  useMarkArrived,
  type CalendarCall,
  type CalendarConsultation,
  type CalendarType,
} from '../api';
import { customerPath } from '../paths';

const MINUTE = 60_000;
const SOON_MINUTES = 30;
/** Follow-up calls get a block this long. */
const CALL_MINUTES = 15;
/** Consultation types without a length get this. */
const DEFAULT_MINUTES = 30;
/** The tablet form (the applicant panel's background page), for the link sent to a customer. */
const FORM_URL = `${import.meta.env.BASE_URL}background`;

type Status = 'done' | 'need' | 'live' | 'soon' | 'upcoming';

const statusOf = (item: CalendarConsultation, now: number): Status => {
  const start = new Date(item.starts_at).getTime();
  const end = start + (item.minutes ?? DEFAULT_MINUTES) * MINUTE;
  if (end <= now) return item.logged ? 'done' : 'need';
  if (start <= now) return 'live';
  return start - now <= SOON_MINUTES * MINUTE ? 'soon' : 'upcoming';
};

type Chosen =
  { kind: 'consultation'; item: CalendarConsultation } | { kind: 'call'; item: CalendarCall };

/**
 * "My consultations" as a week calendar (design: "Seller Consultations Calendar" canvas): the
 * paid sessions in their type's colour and their state's look, with how they are held (online:
 * the seller calls; in person: the customer comes) and whether the customer filled the tablet
 * form; the timed follow-up calls beside them. Each layer (a type, the calls) can be hidden.
 */
export function ConsultationCalendar() {
  const { t } = useTranslation('sales');
  const { t: common } = useTranslation();
  const f = useFormat();
  const cal = useCalendar();
  const startDay = weekStart(cal.kind);
  const [now] = useState(() => new Date());
  const thisWeek = weekOf(now, startDay);
  const [week, setWeek] = useState(thisWeek);
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const [onlyUnlogged, setOnlyUnlogged] = useState(false);
  const [chosenId, setChosenId] = useState<string | null>(null);
  const { data, isPending } = useQuery(sellerCalendarQuery(week));

  const types = new Map((data?.types ?? []).map((type) => [type.id, type]));
  const nowTime = now.getTime();
  const consultations = (data?.consultations ?? []).filter(
    (item) =>
      !hidden.has(String(item.type)) && (!onlyUnlogged || statusOf(item, nowTime) === 'need'),
  );
  const calls = hidden.has('calls') || onlyUnlogged ? [] : (data?.calls ?? []);

  const events: CalendarEvent[] = [
    ...consultations.map((item) => {
      const status = statusOf(item, nowTime);
      const type = types.get(item.type);
      const start = new Date(item.starts_at);
      const meta = `${f.time(start)} · ${type?.name ?? ''}`;
      return {
        id: `c${String(item.id)}`,
        start,
        minutes: item.minutes ?? DEFAULT_MINUTES,
        color: eventColor(type?.color),
        look: status satisfies EventLook,
        title: item.name,
        meta,
        aria: [
          item.name,
          meta,
          t(`mode.${item.mode}`),
          t(`consultationCalendar.status.${status}`),
          t(item.form ? 'consultationCalendar.form.done' : 'consultationCalendar.form.missing'),
        ].join('، '),
        lead: <Icon name={item.mode === 'online' ? 'phone' : 'building'} size={12} />,
        trail: (
          <Icon
            name={item.form ? 'formDone' : 'formMissing'}
            size={13}
            className={item.form ? 'text-good opacity-60' : 'text-danger opacity-80'}
          />
        ),
        tag: status === 'need' ? t('consultationCalendar.tagNeed') : undefined,
        warn: !item.form && (status === 'soon' || status === 'upcoming'),
      };
    }),
    ...calls.map((item) => {
      const start = new Date(item.follow_up_at);
      const meta = `${f.time(start)} · ${t('consultationCalendar.followUp')}`;
      return {
        id: `l${String(item.lead)}`,
        start,
        minutes: CALL_MINUTES,
        color: 'var(--text-2)',
        look: 'call' as const,
        title: item.name,
        meta,
        aria: `${item.name}، ${meta}`,
        lead: <Icon name="followUp" size={12} />,
      };
    }),
  ];

  const chosen: Chosen | undefined = chosenId?.startsWith('c')
    ? (() => {
        const item = consultations.find((row) => `c${String(row.id)}` === chosenId);
        return item && { kind: 'consultation' as const, item };
      })()
    : (() => {
        const item = calls.find((row) => `l${String(row.lead)}` === chosenId);
        return item && { kind: 'call' as const, item };
      })();

  const all = data?.consultations ?? [];
  const unlogged = all.filter((item) => statusOf(item, nowTime) === 'need').length;
  const next = all
    .filter((item) => {
      const status = statusOf(item, nowTime);
      return status === 'live' || status === 'soon' || status === 'upcoming';
    })
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0];
  const end = addDays(week, 6);
  const sameMonth = toCalendar(week, cal.kind).month === toCalendar(end, cal.kind).month;
  const range = common('weekCalendar.range', {
    from: sameMonth ? cal.number.format(toCalendar(week, cal.kind).day) : f.dateShort(week),
    to: f.date(end),
  });
  const go = (target: Date) => {
    setWeek(target);
    setChosenId(null);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          disabled={week.getTime() === thisWeek.getTime()}
          onClick={() => go(thisWeek)}
          className="min-h-11 rounded-full bg-surface px-4 text-sm font-semibold shadow-[inset_0_0_0_1px_var(--line-2)] hover:bg-canvas disabled:opacity-50"
        >
          {common('weekCalendar.thisWeek')}
        </button>
        <span className="flex">
          <IconButton
            icon="chevronStart"
            aria-label={common('weekCalendar.previous')}
            onClick={() => go(addDays(week, -7))}
          />
          <IconButton
            icon="chevronEnd"
            aria-label={common('weekCalendar.next')}
            onClick={() => go(addDays(week, 7))}
          />
        </span>
        <h2 aria-live="polite" className="m-0 flex-1 font-display text-lg font-bold">
          {range}
        </h2>
        {unlogged > 0 && !onlyUnlogged && (
          <button
            type="button"
            onClick={() => setOnlyUnlogged(true)}
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-warn-tint px-4 text-sm font-semibold text-warn"
          >
            <span aria-hidden="true" className="size-2 rounded-full bg-[var(--cal-few)]" />
            {t('consultationCalendar.unlogged', { n: f.number(unlogged) })}
          </button>
        )}
        <TogglePill
          label={t('consultations.unloggedOnly')}
          checked={onlyUnlogged}
          onChange={setOnlyUnlogged}
        />
      </div>

      <div className="flex flex-wrap items-start gap-4 lg:gap-5">
        <aside
          aria-label={t('consultationCalendar.aside')}
          className="flex min-w-0 flex-[1_1_260px] flex-col gap-4 lg:max-w-80"
        >
          {next && (
            <NextSession
              item={next}
              type={types.get(next.type)}
              status={statusOf(next, nowTime)}
              onOpen={() => {
                go(weekOf(new Date(next.starts_at), startDay));
                setChosenId(`c${String(next.id)}`);
              }}
            />
          )}
          <Card className="p-3 max-lg:hidden">
            <MiniMonth
              week={week}
              color="var(--cal-0)"
              min={addDays(thisWeek, -365)}
              max={addDays(thisWeek, 365)}
              marked={(date) => events.some((event) => sameDay(event.start, date))}
              onPick={(date) => go(weekOf(date, startDay))}
            />
          </Card>
          <Card className="p-3 max-lg:hidden">
            <Layers
              types={data?.types ?? []}
              counts={(id) =>
                id === 'calls'
                  ? (data?.calls.length ?? 0)
                  : all.filter((item) => String(item.type) === id).length
              }
              hidden={hidden}
              onToggle={(id) => {
                const nextHidden = new Set(hidden);
                if (nextHidden.has(id)) nextHidden.delete(id);
                else nextHidden.add(id);
                setHidden(nextHidden);
                setChosenId(null);
              }}
            />
          </Card>
        </aside>

        <Card className="min-w-0 flex-[999_1_600px] p-3 lg:p-5">
          <ul className="m-0 mb-3 flex list-none flex-wrap items-center justify-end gap-x-4 gap-y-1.5 p-0 text-xs text-text-2">
            <Legend swatch="bg-track">{t('consultationCalendar.status.done')}</Legend>
            <Legend swatch="bg-warn-tint shadow-[inset_0_0_0_1.5px_var(--cal-few)]">
              {t('consultationCalendar.status.need')}
            </Legend>
            <Legend swatch="bg-primary">{t('consultationCalendar.status.live')}</Legend>
            <Legend swatch="bg-tint">{t('consultationCalendar.status.upcoming')}</Legend>
            <Legend swatch="bg-surface shadow-[inset_0_0_0_1px_var(--line-3)]">
              {t('consultationCalendar.followUp')}
            </Legend>
            <li className="flex items-center gap-1.5">
              <Icon name="phone" size={13} />
              {t('mode.online')}
            </li>
            <li className="flex items-center gap-1.5">
              <Icon name="building" size={13} />
              {t('mode.in_person')}
            </li>
            <li className="flex items-center gap-1.5">
              <Icon name="formDone" size={13} className="text-good" />
              {t('consultationCalendar.form.legendDone')}
            </li>
            <li className="flex items-center gap-1.5">
              <Icon name="formMissing" size={13} className="text-danger" />
              {t('consultationCalendar.form.legendMissing')}
            </li>
          </ul>
          <EventCalendar
            label={t('consultations.title')}
            week={week}
            events={events}
            value={chosen ? chosenId : null}
            onChange={setChosenId}
            loading={isPending}
            now={now}
            details={
              chosen && (
                <Details
                  chosen={chosen}
                  type={chosen.kind === 'consultation' ? types.get(chosen.item.type) : undefined}
                  now={nowTime}
                  onClose={() => setChosenId(null)}
                />
              )
            }
          />
        </Card>
      </div>
    </div>
  );
}

function Legend({ swatch, children }: { swatch: string; children: ReactNode }) {
  return (
    <li className="flex items-center gap-1.5">
      <span aria-hidden="true" className={`h-2.5 w-3.5 rounded-[3px] ${swatch}`} />
      {children}
    </li>
  );
}

/** Which layers show: each consultation type and the follow-up calls, like a calendar app's list. */
function Layers({
  types,
  counts,
  hidden,
  onToggle,
}: {
  types: CalendarType[];
  counts: (id: string) => number;
  hidden: Set<string>;
  onToggle: (id: string) => void;
}) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const rows = [
    ...types.map((type) => ({
      id: String(type.id),
      label: type.name,
      color: eventColor(type.color),
    })),
    { id: 'calls', label: t('consultationCalendar.calls'), color: 'var(--text-2)' },
  ];
  return (
    <fieldset className="m-0 flex flex-col gap-0.5 border-0 p-0">
      <legend className="mb-2 px-2 text-sm font-bold">{t('consultationCalendar.layers')}</legend>
      {rows.map((row) => {
        const on = !hidden.has(row.id);
        return (
          <label
            key={row.id}
            className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-xl px-2 hover:bg-canvas has-focus-visible:outline-2 has-focus-visible:outline-focus"
          >
            <input
              type="checkbox"
              checked={on}
              onChange={() => onToggle(row.id)}
              className="sr-only"
            />
            <span
              aria-hidden="true"
              style={{
                background: on ? row.color : undefined,
                boxShadow: `inset 0 0 0 2px ${row.color}`,
              }}
              className="flex size-[18px] flex-none items-center justify-center rounded-[5px] text-on-primary"
            >
              {on && <Icon name="check" size={12} />}
            </span>
            <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{row.label}</span>
            <span className="text-xs text-text-2">{f.number(counts(row.id))}</span>
          </label>
        );
      })}
    </fieldset>
  );
}

/** The next (or current) session, on the dark card: who, when, how, and its first action. */
function NextSession({
  item,
  type,
  status,
  onOpen,
}: {
  item: CalendarConsultation;
  type: CalendarType | undefined;
  status: Status;
  onOpen: () => void;
}) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const start = new Date(item.starts_at);
  const end = new Date(start.getTime() + (item.minutes ?? DEFAULT_MINUTES) * MINUTE);
  return (
    <section
      aria-label={t('consultationCalendar.next')}
      className="flex flex-col gap-3 rounded-card-sm bg-hero p-4 text-on-hero shadow-hero"
    >
      <span className="flex items-center justify-between gap-2 text-xs">
        <span
          className={`inline-flex items-center gap-2 font-semibold ${status === 'live' ? 'text-live' : 'text-on-hero-2'}`}
        >
          {status === 'live' && <span aria-hidden="true" className="size-2 rounded-full bg-live" />}
          {status === 'live' ? t('consultationCalendar.live') : t('consultationCalendar.next')}
        </span>
        <span className="text-on-hero-2">
          {status === 'live'
            ? t('consultationCalendar.range', { from: f.time(start), to: f.time(end) })
            : `${f.weekday(start)} ${f.time(start)}`}
        </span>
      </span>
      <button type="button" onClick={onOpen} className="flex flex-col gap-1 text-start">
        <span className="text-lg font-bold">{item.name}</span>
        <span className="inline-flex items-center gap-1.5 text-[13px] text-on-hero-2">
          <Icon name={item.mode === 'online' ? 'phone' : 'building'} size={14} />
          {[type?.name, t(`mode.${item.mode}`)].filter(Boolean).join(' · ')}
        </span>
        {!item.form && (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-hero-danger">
            <Icon name="formMissing" size={14} />
            {t('consultationCalendar.form.missing')}
          </span>
        )}
      </button>
      <StartAction item={item} status={status} onHero />
    </section>
  );
}

/** Starting a session: online, the seller calls; in person, they mark the customer arrived. */
function StartAction({
  item,
  status,
  onHero = false,
}: {
  item: CalendarConsultation;
  status: Status;
  onHero?: boolean;
}) {
  const { t } = useTranslation('sales');
  const arrived = useMarkArrived();
  const primary = onHero
    ? 'inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-surface px-4 text-sm font-bold text-primary-text'
    : buttonClass('primary', 'h-11 gap-2 px-4 text-sm');
  if (status !== 'live' && status !== 'soon') return null;
  if (item.mode === 'online')
    return (
      <a href={`tel:${item.phone}`} className={primary}>
        <Icon name="phone" size={16} />
        {t('consultationCalendar.call')}
      </a>
    );
  if (item.arrived_at)
    return (
      <span
        className={`inline-flex items-center gap-2 text-sm font-semibold ${onHero ? 'text-live' : 'text-good'}`}
      >
        <Icon name="check" size={16} />
        {t('consultationCalendar.arrived')}
      </span>
    );
  return (
    <button
      type="button"
      disabled={arrived.isPending}
      onClick={() =>
        arrived.mutate(item.id, {
          onSuccess: () =>
            toast.success(t('consultationCalendar.arrivedToast', { name: item.name })),
          onError: () => toast.error(t('consultationCalendar.error')),
        })
      }
      className={primary}
    >
      <Icon name="building" size={16} />
      {t('consultationCalendar.markArrived')}
    </button>
  );
}

/** The chosen event's card: beside its block, or under the day on a phone. */
function Details({
  chosen,
  type,
  now,
  onClose,
}: {
  chosen: Chosen;
  type: CalendarType | undefined;
  now: number;
  onClose: () => void;
}) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const outline = buttonClass('outline', 'h-11 px-4 text-sm');
  const primary = buttonClass('primary', 'h-11 px-4 text-sm');
  const item = chosen.item;
  const start = new Date(chosen.kind === 'call' ? chosen.item.follow_up_at : chosen.item.starts_at);
  const minutes = chosen.kind === 'call' ? CALL_MINUTES : (chosen.item.minutes ?? DEFAULT_MINUTES);
  const end = new Date(start.getTime() + minutes * MINUTE);
  const status = chosen.kind === 'consultation' ? statusOf(chosen.item, now) : null;
  const action = (label: string) =>
    t('consultations.actionsFor', { action: label, name: item.name });
  const customerLink = (
    <Link
      to={customerPath(item.customer)}
      aria-label={action(t('consultations.customer'))}
      className={outline}
    >
      {t('consultations.customer')}
    </Link>
  );

  let actions: ReactNode;
  let statusLine: ReactNode = null;
  if (chosen.kind === 'call') {
    actions = (
      <>
        <ContactLogButton
          customer={item.customer}
          name={item.name}
          start={{ channel: 'call' }}
          className={outline}
        >
          {t('consultationCalendar.logCall')}
        </ContactLogButton>
        <a href={`tel:${item.phone}`} className={primary}>
          {t('consultationCalendar.callNow')}
        </a>
      </>
    );
  } else {
    const consultation = chosen.item;
    const log = (look: string) => (
      <ContactLogButton
        customer={consultation.customer}
        name={consultation.name}
        start={{ channel: 'meeting', reservation: consultation.id }}
        aria-label={action(t('consultations.log'))}
        className={look}
      >
        {t('consultations.log')}
      </ContactLogButton>
    );
    const formLink = !consultation.form && (
      <a
        href={messageHref(
          'whatsapp',
          consultation.phone,
          t('consultationCalendar.formText', {
            name: consultation.name,
            url: `${window.location.origin}${FORM_URL}`,
          }),
        )}
        target="_blank"
        rel="noreferrer"
        className={outline}
      >
        {t('consultationCalendar.sendForm')}
      </a>
    );
    const reminder = (
      <a
        href={messageHref(
          'whatsapp',
          consultation.phone,
          t('consultations.remindText', {
            name: consultation.name,
            type: type?.name ?? '',
            when: `${f.weekday(start)} ${f.time(start)}`,
          }),
        )}
        target="_blank"
        rel="noreferrer"
        className={outline}
      >
        {t('consultationCalendar.remind')}
      </a>
    );
    const inPersonWaiting =
      consultation.mode === 'in_person' && (status === 'live' || status === 'soon');
    statusLine = (
      <span
        className={`self-start rounded-full px-2.5 py-0.5 text-xs font-bold ${
          status === 'need'
            ? 'bg-warn-tint text-warn'
            : status === 'done' || status === 'live'
              ? 'bg-good-tint text-good'
              : 'bg-info-tint text-info'
        }`}
      >
        {inPersonWaiting
          ? consultation.arrived_at
            ? t('consultationCalendar.arrived')
            : t('consultationCalendar.waiting')
          : t(`consultationCalendar.status.${status ?? 'upcoming'}`)}
      </span>
    );
    actions = {
      done: customerLink,
      need: (
        <>
          {customerLink}
          {log(primary)}
        </>
      ),
      live: (
        <>
          {log(outline)}
          <StartAction item={consultation} status="live" />
        </>
      ),
      soon: (
        <>
          {formLink}
          {customerLink}
          <StartAction item={consultation} status="soon" />
        </>
      ),
      upcoming: (
        <>
          {formLink}
          {reminder}
          {customerLink}
        </>
      ),
    }[status ?? 'upcoming'];
  }

  return (
    <section
      role="dialog"
      aria-label={item.name}
      className="flex flex-col gap-3.5 rounded-card-sm bg-surface p-4 shadow-toast"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="mt-1.5 size-4 flex-none rounded-[3px]"
          style={
            chosen.kind === 'call'
              ? { boxShadow: 'inset 0 0 0 1.5px var(--text-2)' }
              : { background: eventColor(type?.color) }
          }
        />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-base font-bold">{item.name}</span>
          <span className="text-[13px]">
            {t('consultationCalendar.when', {
              day: f.weekday(start),
              from: f.time(start),
              to: f.time(end),
            })}
          </span>
          {f.gregorian(start) && (
            <span className="text-xs text-text-2">{`⁦${f.gregorian(start) ?? ''}⁩`}</span>
          )}
        </span>
        <IconButton icon="close" aria-label={t('consultationCalendar.close')} onClick={onClose} />
      </div>
      <ul className="m-0 flex list-none flex-col gap-2 p-0 text-[13px] text-text-2">
        <li className="flex items-center gap-2.5">
          <Icon
            name={
              chosen.kind === 'call'
                ? 'followUp'
                : chosen.item.mode === 'online'
                  ? 'phone'
                  : 'building'
            }
            size={16}
          />
          {chosen.kind === 'call'
            ? t('consultationCalendar.followUp')
            : [
                type?.name,
                t(`mode.${chosen.item.mode}`),
                chosen.item.minutes !== null &&
                  t('consultationCalendar.minutes', { n: f.number(chosen.item.minutes) }),
              ]
                .filter(Boolean)
                .join(' · ')}
        </li>
        <li className="flex items-center gap-2.5">
          <Icon name="phone" size={16} />
          <span dir="ltr">{formatPhone(item.phone)}</span>
        </li>
        {chosen.kind === 'consultation' && (
          <li
            className={`flex items-center gap-2.5 ${chosen.item.form ? '' : 'font-semibold text-danger'}`}
          >
            <Icon name={chosen.item.form ? 'formDone' : 'formMissing'} size={16} />
            {t(
              chosen.item.form
                ? 'consultationCalendar.form.done'
                : 'consultationCalendar.form.missing',
            )}
          </li>
        )}
        {chosen.kind === 'call' && chosen.item.reason && (
          <li className="rounded-xl bg-canvas px-3 py-2 leading-6 text-text">
            {chosen.item.reason}
          </li>
        )}
      </ul>
      {statusLine}
      <div className="flex flex-wrap justify-end gap-2">{actions}</div>
    </section>
  );
}
