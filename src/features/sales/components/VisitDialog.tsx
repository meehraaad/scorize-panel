import { useQuery } from '@tanstack/react-query';
import { useId, useState, type SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { ColleaguePicker } from '@/components/tasks/ColleaguePicker';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Icon } from '@/components/ui/Icon';
import { InlineConfirm } from '@/components/ui/InlineConfirm';
import { Notice } from '@/components/ui/Notice';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { Switch } from '@/components/ui/Switch';
import { TextAreaField } from '@/components/ui/TextField';
import { WeekCalendar } from '@/components/ui/WeekCalendar';
import { ApiError } from '@/lib/api/client';
import { addDays, weekOf, weekStart } from '@/lib/calendar';
import { useCalendar } from '@/lib/i18n/useCalendar';
import { useFormat } from '@/lib/i18n/useFormat';
import { tasksQuery } from '@/lib/tasks/api';
import { toast } from '@/lib/toast';
import {
  customerVisitsQuery,
  useBookVisit,
  useCancelVisit,
  visitSlotsQuery,
  type OfficeVisit,
} from '../api/visits';

const FORM = 'visit-form';
/** How far ahead a meeting can be set (Django: eight weeks). */
const WEEKS_AHEAD = 8;

/**
 * Set an in-person meeting at the office with a customer (S75), from the customer page or the call
 * popup: the office's hours on a week, a time when every room is taken can't be picked. The
 * customer gets an SMS with the time and address; a colleague can be asked to join (a request
 * task). A customer with a meeting ahead sees it here, with "cancel" to pick another time.
 */
export function VisitDialog({
  customer,
  open,
  onClose,
}: {
  customer: { id: number; name: string };
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation('sales');
  const visits = useQuery({ ...customerVisitsQuery(customer.id), enabled: open });
  const upcoming = visits.data?.upcoming ?? null;
  const ready = visits.data !== undefined;
  const canBook = ready && !upcoming && visits.data.rooms > 0;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="wide"
      title={t('visit.title', { name: customer.name })}
      subtitle={t('visit.subtitle')}
      closeLabel={t('close')}
      footer={
        canBook ? (
          <VisitFooter onClose={onClose} />
        ) : (
          <Button variant="outline" onClick={onClose}>
            {t('close')}
          </Button>
        )
      }
    >
      {visits.isError ? (
        <Notice tone="error">{t('error')}</Notice>
      ) : !ready ? (
        <SkeletonRows rows={4} />
      ) : upcoming ? (
        <Upcoming customer={customer.id} visit={upcoming} />
      ) : visits.data.rooms === 0 ? (
        <Notice tone="info">{t('visit.noRooms')}</Notice>
      ) : (
        <VisitForm customer={customer.id} onDone={onClose} />
      )}
    </Dialog>
  );
}

function VisitFooter({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation('sales');
  return (
    <>
      <Button type="submit" form={FORM}>
        <Icon name="building" size={17} />
        {t('visit.submit')}
      </Button>
      <Button variant="outline" onClick={onClose}>
        {t('cancel')}
      </Button>
    </>
  );
}

/** The meeting already set: when, where, who joins, and "cancel" to free the room. */
function Upcoming({ customer, visit }: { customer: number; visit: OfficeVisit }) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const cancel = useCancelVisit(customer);
  const [confirming, setConfirming] = useState(false);
  const details = [
    visit.room && t('visit.room', { room: visit.room }),
    visit.seller && !visit.mine && t('visit.by', { name: visit.seller }),
    visit.colleague && t('visit.with', { name: visit.colleague }),
  ].filter(Boolean);

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4 py-4">
      <div className="flex items-center gap-4 rounded-card-sm bg-surface p-5 shadow-toast">
        <span
          aria-hidden="true"
          className="flex size-12 flex-none items-center justify-center rounded-2xl bg-tint text-primary-text"
        >
          <Icon name="building" size={22} />
        </span>
        <span className="flex min-w-0 flex-col gap-1">
          <span className="text-xs text-text-2">{t('visit.booked')}</span>
          <span className="text-[17px] font-bold">
            {t('visit.when', { day: f.date(visit.starts_at), time: f.time(visit.starts_at) })}
          </span>
          {details.length > 0 && <span className="text-sm text-text-2">{details.join(' · ')}</span>}
          {visit.note && <span className="text-sm leading-6">{visit.note}</span>}
        </span>
      </div>
      {confirming ? (
        <InlineConfirm
          message={t('visit.cancelConfirm')}
          confirmLabel={t('visit.cancelYes')}
          cancelLabel={t('visit.cancelNo')}
          pending={cancel.isPending}
          onCancel={() => setConfirming(false)}
          onConfirm={() =>
            cancel.mutate(visit.id, {
              onSuccess: () => toast.success(t('visit.cancelled')),
              onError: () => toast.error(t('error')),
              onSettled: () => setConfirming(false),
            })
          }
        />
      ) : (
        <div className="flex flex-col gap-2">
          <p className="m-0 text-sm leading-6 text-text-2">{t('visit.changeHint')}</p>
          {(visit.mine || visit.seller === null) && (
            <Button variant="outline" className="self-start" onClick={() => setConfirming(true)}>
              {t('visit.cancel')}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function VisitForm({ customer, onDone }: { customer: number; onDone: () => void }) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const cal = useCalendar();
  const startDay = weekStart(cal.kind);
  const [now] = useState(() => new Date());
  const thisWeek = weekOf(now, startDay);
  const [week, setWeek] = useState(thisWeek);
  const slots = useQuery(visitSlotsQuery(week));
  const book = useBookVisit(customer);
  const [at, setAt] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [sms, setSms] = useState(true);
  const [asking, setAsking] = useState(false);
  const colleagues = useQuery({ ...tasksQuery('sales'), enabled: asking });
  const [colleague, setColleague] = useState<number | null>(null);
  const [colleagueNote, setColleagueNote] = useState('');
  const [checked, setChecked] = useState(false);
  const hintId = useId();
  const times = slots.data?.slots ?? [];
  const free = times.some((slot) => slot.left > 0);

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (book.isPending) return;
    setChecked(true);
    if (!at || (asking && colleague === null)) return;
    book.mutate(
      {
        starts_at: at,
        note: note.trim(),
        sms,
        ...(asking && colleague !== null
          ? { colleague, colleague_note: colleagueNote.trim() }
          : {}),
      },
      {
        onSuccess: (visit) => {
          toast.success(
            t('visit.saved', { day: f.weekday(visit.starts_at), time: f.time(visit.starts_at) }),
          );
          onDone();
        },
        onError: (error) => {
          const code =
            error instanceof ApiError ? (error.body as { code?: unknown } | null)?.code : null;
          if (code === 'full') {
            setAt(null);
            void slots.refetch();
          }
          toast.error(
            code === 'full'
              ? t('visit.full')
              : code === 'booked'
                ? t('visit.alreadyBooked')
                : t('error'),
          );
        },
      },
    );
  };

  return (
    <form id={FORM} noValidate onSubmit={submit} className="flex flex-col gap-5">
      <WeekCalendar
        label={t('visit.calendar')}
        week={week}
        onWeekChange={setWeek}
        firstWeek={thisWeek}
        lastWeek={addDays(thisWeek, 7 * WEEKS_AHEAD)}
        times={times}
        minutes={slots.data?.minutes ?? 60}
        color="var(--cal-0)"
        value={at}
        onChange={setAt}
        loading={slots.isPending}
        now={now}
        details={
          at && (
            <p className="m-0 flex items-center gap-2 rounded-2xl bg-surface px-4 py-3 text-sm font-semibold shadow-toast">
              <Icon name="check" size={16} className="text-good" />
              {t('visit.picked', { day: f.weekday(at), time: f.time(at) })}
            </p>
          )
        }
        empty={
          !slots.isPending && !free ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl bg-surface px-6 py-5 text-center shadow-[0_12px_32px_rgb(27_16_32/0.12)]">
              <span className="text-sm font-semibold">{t('visit.weekFull')}</span>
              <Button variant="outline" onClick={() => setWeek(addDays(week, 7))}>
                {t('visit.nextWeek')}
              </Button>
            </div>
          ) : undefined
        }
      />
      {checked && !at && (
        <p role="alert" className="m-0 -mt-2 text-sm text-danger">
          {t('visit.pickTime')}
        </p>
      )}
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="flex flex-col gap-3">
          <TextAreaField
            label={t('visit.note')}
            hint={t('visit.noteHint')}
            rows={3}
            value={note}
            maxLength={2000}
            onChange={(event) => setNote(event.target.value)}
          />
          <Switch
            label={t('visit.sms')}
            description={t('visit.smsHint')}
            checked={sms}
            onChange={setSms}
          />
        </div>
        <div className="flex flex-col gap-3">
          <Switch
            label={t('visit.ask')}
            description={t('visit.askHint')}
            checked={asking}
            onChange={setAsking}
          />
          {asking &&
            (colleagues.data ? (
              <>
                <ColleaguePicker
                  colleagues={colleagues.data.colleagues}
                  picked={colleague === null ? [] : [colleague]}
                  onToggle={setColleague}
                  label={t('visit.colleague')}
                  searchLabel={t('customer.newTask.peerSearch')}
                  noMatch={t('customer.newTask.peerNoMatch')}
                  describedBy={hintId}
                />
                <span
                  id={hintId}
                  className={`text-sm leading-6 ${checked && colleague === null ? 'text-danger' : 'text-text-2'}`}
                >
                  {checked && colleague === null
                    ? t('visit.pickColleague')
                    : t('visit.colleagueHint')}
                </span>
                <TextAreaField
                  label={t('visit.colleagueNote')}
                  rows={2}
                  value={colleagueNote}
                  maxLength={2000}
                  onChange={(event) => setColleagueNote(event.target.value)}
                />
              </>
            ) : (
              <SkeletonRows rows={3} />
            ))}
        </div>
      </div>
    </form>
  );
}
