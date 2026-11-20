import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Switch } from '@/components/ui/Switch';
import { TimeSelect, type TimeOption } from '@/components/ui/TimeSelect';
import { ApiError } from '@/lib/api/client';
import { useFormat } from '@/lib/i18n/useFormat';
import { toast } from '@/lib/toast';
import { useSetFollowUp } from '../api/calendarMutations';
import { useChangeVisit } from '../api/visits';
import { MINUTE } from '../consultationStatus';

/** Times offered for a start: the working day, every 15 minutes. */
const FIRST_HOUR = 7;
const LAST_HOUR = 22;
const STEP = 15;
/** The longest end offered: four hours after the start. */
const LONGEST = 240;

/** What the card changes: a follow-up call (by its lead) or a meeting at the office. */
export type TimedEvent =
  | { kind: 'call'; lead: number; starts_at: string; minutes: number }
  | { kind: 'visit'; id: number; starts_at: string; minutes: number };

const dayStart = (at: Date) => new Date(at.getFullYear(), at.getMonth(), at.getDate());

/**
 * The event card's day, start and end, as a calendar app shows them: tap the start or the end and
 * pick a time from the list (`TimeSelect`). A new start keeps the length; the ends say how long
 * each makes it. Saving moves a call (and its length), or a meeting with its follow-up, inside the
 * office's hours while a room is free; a meeting's customer can be texted the new start.
 */
export function EventTimes({ event, now }: { event: TimedEvent; now: number }) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const setFollowUp = useSetFollowUp();
  const changeVisit = useChangeVisit();
  const saved = new Date(event.starts_at).getTime();
  const [start, setStart] = useState(saved);
  const [minutes, setMinutes] = useState(event.minutes);
  const [sms, setSms] = useState(true);
  const pending = setFollowUp.isPending || changeVisit.isPending;
  const changed = start !== saved || minutes !== event.minutes;
  const moved = start !== saved;
  const day = dayStart(new Date(saved)).getTime();

  const length = (n: number) =>
    n < 60
      ? t('eventTimes.minutes', { n: f.number(n) })
      : t('eventTimes.hours', { n: f.number(Math.round((n / 60) * 100) / 100) });

  const starts: number[] = [];
  for (
    let at = day + FIRST_HOUR * 60 * MINUTE;
    at <= day + LAST_HOUR * 60 * MINUTE;
    at += STEP * MINUTE
  )
    if (at > now || at === saved) starts.push(at);
  if (!starts.includes(start)) starts.push(start);
  starts.sort((a, b) => a - b);
  const startOptions: TimeOption[] = starts.map((at) => ({
    value: String(at),
    label: f.time(new Date(at)),
  }));

  const lengths: number[] = [...(event.kind === 'call' ? [5, 10] : [])];
  for (let n = STEP; n <= LONGEST; n += STEP) lengths.push(n);
  if (!lengths.includes(minutes)) lengths.push(minutes);
  lengths.sort((a, b) => a - b);
  const endOptions: TimeOption[] = lengths.map((n) => ({
    value: String(n),
    label: f.time(new Date(start + n * MINUTE)),
    hint: length(n),
  }));

  const reset = () => {
    setStart(saved);
    setMinutes(event.minutes);
  };
  const done = (at: number, n: number) =>
    toast.success(
      t('eventTimes.saved', {
        day: f.weekday(new Date(at)),
        from: f.time(new Date(at)),
        to: f.time(new Date(at + n * MINUTE)),
      }),
    );
  // Awaited, not `mutate` callbacks: the calendar redraws the event (and this card) as it saves.
  const save = async () => {
    if (pending || !changed) return;
    if (start <= Date.now()) {
      toast.error(t('followUpDialog.past'));
      return;
    }
    const at = new Date(start).toISOString();
    try {
      if (event.kind === 'call') await setFollowUp.mutateAsync({ lead: event.lead, at, minutes });
      else
        await changeVisit.mutateAsync({
          id: event.id,
          starts_at: at,
          minutes,
          sms: moved && sms,
        });
      done(start, minutes);
    } catch (error) {
      const code =
        error instanceof ApiError ? (error.body as { code?: unknown } | null)?.code : null;
      const status = error instanceof ApiError ? error.status : null;
      toast.error(
        event.kind === 'visit' && code === 'full'
          ? t('visit.full')
          : event.kind === 'visit' && status === 400
            ? t('eventTimes.closed')
            : t('error'),
      );
      reset();
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5 text-[13px]">
        <span className="me-1 text-text-2">{f.weekday(new Date(start))}</span>
        <TimeSelect
          label={t('eventTimes.start')}
          value={String(start)}
          options={startOptions}
          disabled={pending}
          onChange={(value) => setStart(Number(value))}
        />
        <span aria-hidden="true" className="text-text-3">
          –
        </span>
        <TimeSelect
          label={t('eventTimes.end')}
          value={String(minutes)}
          options={endOptions}
          disabled={pending}
          onChange={(value) => setMinutes(Number(value))}
        />
        <span className="ms-1 text-xs text-text-2">{length(minutes)}</span>
      </div>
      {changed && (
        <div className="flex flex-col gap-2 rounded-xl bg-canvas p-2.5">
          {event.kind === 'visit' && moved && (
            <Switch
              label={t('visit.sms')}
              description={t('eventTimes.smsHint')}
              checked={sms}
              onChange={setSms}
            />
          )}
          <div className="flex flex-wrap gap-2">
            <Button className="h-11 px-4 text-sm" disabled={pending} onClick={() => void save()}>
              {t('eventTimes.save')}
            </Button>
            <Button variant="outline" className="h-11 px-4 text-sm" onClick={reset}>
              {t('cancel')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
