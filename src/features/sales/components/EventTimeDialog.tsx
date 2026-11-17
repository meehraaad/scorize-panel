import { useState, type SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { SelectField } from '@/components/ui/Choices';
import { DatePicker } from '@/components/ui/DatePicker';
import { Dialog } from '@/components/ui/Dialog';
import { Switch } from '@/components/ui/Switch';
import { ApiError } from '@/lib/api/client';
import { toValue } from '@/lib/calendar';
import { useDisplayName } from '@/lib/i18n/useDisplayName';
import { useFormat } from '@/lib/i18n/useFormat';
import { toast } from '@/lib/toast';
import { fromLocalInput } from '@/lib/when';
import { useSetFollowUp } from '../api';
import { useChangeVisit } from '../api/visits';
import { MINUTE } from '../consultationStatus';

/** The lengths offered for the end (minutes); a call can be shorter than a meeting. */
const LENGTHS = [15, 30, 45, 60, 75, 90, 120, 150, 180, 240] as const;
const CALL_LENGTHS = [5, 10, ...LENGTHS] as const;

/** What the window changes: a follow-up call (by its lead) or a meeting at the office. */
export type TimedEvent =
  | { kind: 'call'; lead: number; name: string; starts_at: string; minutes: number }
  | { kind: 'visit'; id: number; name: string; starts_at: string; minutes: number };

/**
 * A follow-up call's or an office meeting's start and end, from the calendar (`eventTimes`): the
 * start is a day and time, the end a time after it. A meeting moves with its follow-up, inside the
 * office's hours and while a room is free; its customer can be texted the new time.
 */
export function EventTimeDialog({ event, onClose }: { event: TimedEvent; onClose: () => void }) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const named = useDisplayName();
  const setFollowUp = useSetFollowUp();
  const changeVisit = useChangeVisit();
  const [start, setStart] = useState(() => toValue(new Date(event.starts_at), true));
  const [minutes, setMinutes] = useState(event.minutes);
  const [sms, setSms] = useState(true);
  const [checked, setChecked] = useState(false);
  const [openedAt] = useState(() => Date.now());
  const startsAt = fromLocalInput(start);
  const past = startsAt !== null && new Date(startsAt).getTime() < openedAt;
  const moved =
    startsAt !== null && new Date(startsAt).getTime() !== new Date(event.starts_at).getTime();
  const pending = setFollowUp.isPending || changeVisit.isPending;
  const base = startsAt ? new Date(startsAt).getTime() : new Date(event.starts_at).getTime();
  const lengths: number[] = [...(event.kind === 'call' ? CALL_LENGTHS : LENGTHS)];
  if (!lengths.includes(event.minutes)) lengths.push(event.minutes);
  lengths.sort((a, b) => a - b);

  const done = (at: string, length: number) => {
    const from = new Date(at);
    toast.success(
      t('eventTimes.saved', {
        day: f.weekday(from),
        from: f.time(from),
        to: f.time(new Date(from.getTime() + length * MINUTE)),
      }),
    );
    onClose();
  };

  const submit = (form: SubmitEvent<HTMLFormElement>) => {
    form.preventDefault();
    if (pending) return;
    setChecked(true);
    if (!startsAt || past) return;
    if (event.kind === 'call') {
      setFollowUp.mutate(
        { lead: event.lead, at: startsAt, minutes },
        { onSuccess: () => done(startsAt, minutes), onError: () => toast.error(t('error')) },
      );
      return;
    }
    changeVisit.mutate(
      { id: event.id, starts_at: startsAt, minutes, sms: moved && sms },
      {
        onSuccess: (visit) => done(visit.starts_at, visit.minutes),
        onError: (error) => {
          const code =
            error instanceof ApiError ? (error.body as { code?: unknown } | null)?.code : null;
          const status = error instanceof ApiError ? error.status : null;
          toast.error(
            code === 'full'
              ? t('visit.full')
              : status === 400
                ? t('eventTimes.closed')
                : t('error'),
          );
        },
      },
    );
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={t('eventTimes.title', { name: named(event.name) })}
      subtitle={t(event.kind === 'call' ? 'eventTimes.callHint' : 'eventTimes.visitHint')}
      closeLabel={t('close')}
      footer={
        <>
          <Button type="submit" form="event-times" disabled={pending}>
            {t('eventTimes.save')}
          </Button>
          <Button variant="outline" onClick={onClose}>
            {t('cancel')}
          </Button>
        </>
      }
    >
      <form id="event-times" noValidate onSubmit={submit} className="flex flex-col gap-5">
        <DatePicker
          time
          only="future"
          minuteStep={5}
          label={t('eventTimes.start')}
          value={start}
          onChange={setStart}
          error={
            checked && (!startsAt || past)
              ? t(past ? 'followUpDialog.past' : 'followUpDialog.dateRequired')
              : undefined
          }
        />
        <SelectField
          label={t('eventTimes.end')}
          value={String(minutes)}
          onChange={(value) => setMinutes(Number(value))}
          options={lengths.map((length) => ({
            value: String(length),
            label: t('eventTimes.endOption', {
              time: f.time(new Date(base + length * MINUTE)),
              n: f.number(length),
            }),
          }))}
        />
        {event.kind === 'visit' && moved && (
          <Switch
            label={t('visit.sms')}
            description={t('eventTimes.smsHint')}
            checked={sms}
            onChange={setSms}
          />
        )}
      </form>
    </Dialog>
  );
}
