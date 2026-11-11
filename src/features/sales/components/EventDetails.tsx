import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { ContactLogButton } from '@/components/sales/ContactLogButton';
import { buttonClass } from '@/components/ui/buttonStyles';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { eventColor } from '@/lib/calendar';
import { useFormat } from '@/lib/i18n/useFormat';
import { messageHref } from '@/lib/sales/api';
import { callHref, useLinphoneDial } from '@/lib/sales/dial';
import { formatPhone } from '@/lib/site';
import { toast } from '@/lib/toast';
import {
  useMarkArrived,
  type CalendarCall,
  type CalendarConsultation,
  type CalendarType,
} from '../api';
import {
  CALL_MINUTES,
  DEFAULT_MINUTES,
  MINUTE,
  statusOf,
  type Chosen,
  type Status,
} from '../consultationStatus';
import { useSalesFormat } from '../format';
import { customerPath } from '../paths';

/*
 * A consultation's or follow-up call's card with its actions (log the session, call, mark arrived,
 * send the form, remind, move the call): beside its block on the consultations calendar, and as
 * a popup from Today's plan.
 */

/** The tablet form (the applicant panel's background page), for the link sent to a customer. */
const FORM_URL = `${import.meta.env.BASE_URL}background`;

/** Starting a session: online, the seller calls; in person, they mark the customer arrived. */
export function StartAction({
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
  const linphone = useLinphoneDial();
  const primary = onHero
    ? 'inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-surface px-4 text-sm font-bold text-primary-text'
    : buttonClass('primary', 'h-11 gap-2 px-4 text-sm');
  if (status !== 'live' && status !== 'soon') return null;
  if (item.mode === 'online')
    return (
      <a href={callHref(item.phone, linphone)} className={primary}>
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
export function EventDetails({
  chosen,
  type,
  now,
  onClose,
  onMoveCall,
}: {
  chosen: Chosen;
  type: CalendarType | undefined;
  now: number;
  onClose: () => void;
  /** Another time for a follow-up call (dragging's keyboard and phone twin). */
  onMoveCall: (call: CalendarCall) => void;
}) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const s = useSalesFormat();
  const linphone = useLinphoneDial();
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
    const call = chosen.item;
    actions = (
      <>
        <button
          type="button"
          onClick={() => onMoveCall(call)}
          aria-label={action(t('followUpDialog.change'))}
          className={outline}
        >
          {t('followUpDialog.change')}
        </button>
        <ContactLogButton
          customer={item.customer}
          name={item.name}
          start={{ channel: 'call' }}
          className={outline}
        >
          {t('consultationCalendar.logCall')}
        </ContactLogButton>
        <a href={callHref(item.phone, linphone)} className={primary}>
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
        start={{
          channel: 'meeting',
          reservation: consultation.id,
          session: {
            title: type?.name,
            starts_at: consultation.starts_at,
            minutes: consultation.minutes,
            mode: consultation.mode,
          },
        }}
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
          <Link
            to={customerPath(item.customer)}
            onClick={onClose}
            className="-my-2.5 inline-flex min-h-11 items-center self-start text-base font-bold text-text underline-offset-4 hover:text-primary-text hover:underline focus-visible:underline"
          >
            {item.name}
          </Link>
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
        {chosen.kind === 'consultation' && !chosen.item.mine && (
          <li className="flex items-center gap-2.5">
            <Icon name="user" size={16} />
            {chosen.item.seller
              ? t('consultationCalendar.seller', { name: chosen.item.seller })
              : t('consultationCalendar.noSeller')}
          </li>
        )}
        {chosen.kind === 'call' && s.owner(chosen.item.seller) && (
          <li className={`flex items-center gap-2.5 ${chosen.item.seller ? '' : 'text-warn'}`}>
            <Icon name="user" size={16} />
            {s.owner(chosen.item.seller)}
          </li>
        )}
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
