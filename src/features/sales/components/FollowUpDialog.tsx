import { lazy, Suspense, useState, type SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { ChoiceGroup, TextAreaField } from '@/components/ui/Choices';
import { Notice } from '@/components/ui/Notice';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { Dialog } from '@/components/ui/Dialog';
import { ApiError } from '@/lib/api/client';
import { ON_SERVER } from '@/lib/applicant/onServer';
import { parseValue, toValue } from '@/lib/calendar';
import { toast } from '@/lib/toast';
import { useCreateTask } from '@/lib/tasks/changes';
import { SALES_KEY } from '@/lib/sales/api';
import { useSetFollowUp, type CustomerMatch, type LeadMatch } from '../api';
import { CustomerPicker } from './CustomerPicker';
import { followAtOf, followOnOf, isVisitConflict, type Follow } from '../followUp';
import { FollowUpNow } from './FollowUpNow';
import { FollowUpWhen } from './FollowUpWhen';
import { useFormat } from '@/lib/i18n/useFormat';
import { useDisplayName } from '@/lib/i18n/useDisplayName';

// The office's week of rooms loads only when "meeting" is picked.
const VisitForm = lazy(() =>
  import('./VisitDialog').then((module) => ({ default: module.VisitForm })),
);
const VisitFooter = lazy(() =>
  import('./VisitDialog').then((module) => ({ default: module.VisitFooter })),
);

export type How = 'call' | 'meeting';
const HOWS = ['call', 'meeting'] as const satisfies readonly How[];

/**
 * Set a customer's next follow-up without logging a contact: a new one at a picked time (the
 * seller finds the customer), or a customer's follow-up moved to another time (`lead` given: the
 * keyboard and phone way to move a call, besides dragging it). The time is picked the same way as
 * in the contact log (FollowUpWhen). A seller who did talk to the customer logs it instead
 * (`onLog`), so the follow-up is closed with what happened.
 *
 * A customer with no open lead (found when the search has none) gets a follow-up task about them
 * and no lead: a lead made here would be a second "manual" one in the sources and the conversion.
 *
 * A follow-up can also be a meeting at the office (S79, `visitFollowUp`): "meeting" shows the
 * office's week (VisitForm), and the meeting it sets is the customer's follow-up.
 */
export function FollowUpDialog({
  open,
  onClose,
  at,
  lead,
  current,
  timed = true,
  onLog,
  how: firstHow = 'call',
}: {
  open: boolean;
  onClose: () => void;
  /** The time to start from (a picked spot, or the call's time). */
  at: Date | null;
  /** `customer`: their account, so a meeting at the office can be set instead (S79). */
  lead?: { id: number; name: string; customer?: number | undefined } | undefined;
  /** The open follow-up's text: shown on top and the text field's start. */
  current?: string | undefined;
  /** False: the follow-up has a day but no hour (`at` is its 23:59): it starts on that day only. */
  timed?: boolean | undefined;
  /** "I talked to them": opens the contact log instead. */
  onLog?: (() => void) | undefined;
  /** Which side it opens on: a call, or the meeting at the office (the customer page's button). */
  how?: How | undefined;
}) {
  const { t } = useTranslation('sales');
  const named = useDisplayName();
  const f = useFormat();
  const save = useSetFollowUp();
  const createTask = useCreateTask(SALES_KEY);
  const [picked, setPicked] = useState<LeadMatch | null>(null);
  const [noLead, setNoLead] = useState<CustomerMatch | null>(null);
  // A day with no hour starts on that day (`dayFollowUps`), else on a quick time as before.
  const start = timed || ON_SERVER.dayFollowUps ? at : null;
  const [follow, setFollow] = useState<Follow>(start ? 'other' : 'tomorrow');
  const [date, setDate] = useState(() => (start ? toValue(start, timed) : ''));
  const [text, setText] = useState(current ?? '');
  const [checked, setChecked] = useState(false);
  const [openedAt] = useState(() => Date.now());
  const target = lead?.id ?? picked?.id ?? noLead?.customer ?? null;
  const name = lead?.name ?? picked?.name ?? noLead?.name ?? '';
  const when = followAtOf(follow, date);
  const on = followOnOf(follow, date);
  const day = on ? parseValue(on) : null;
  const past =
    when !== null
      ? new Date(when).getTime() < openedAt
      : on !== null && on < toValue(new Date(openedAt), false);
  /** Moving the customer's follow-up: the time it has now. */
  const moving = lead ? at : null;
  const customer = lead?.customer ?? picked?.customer ?? noLead?.customer ?? null;
  const [how, setHow] = useState<How>(firstHow);
  // Offered before a customer is picked too: the seller can decide on a meeting first.
  const offersMeeting = ON_SERVER.visitFollowUp && (customer !== null || !lead);
  /** "Meeting" picked: the customer it is set with (none yet: the picker comes first). */
  const meetingPicked = offersMeeting && how === 'meeting';
  const meeting = meetingPicked ? customer : null;

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setChecked(true);
    if (target === null || (!when && !on) || past) return;
    const saved = when
      ? t('followUpDialog.when', { day: f.weekday(when), time: f.time(when) })
      : day
        ? f.weekday(day)
        : '';
    if (noLead) {
      createTask.mutate(
        {
          user: noLead.customer,
          kind: 'mine',
          ...(when ? { due_at: when } : { due_on: on ?? '' }),
          text: text.trim() || t('followUpDialog.taskText', { name: named(noLead.name) }),
        },
        {
          onSuccess: () => {
            toast.success(t('followUpDialog.saved', { when: saved }));
            onClose();
          },
          onError: () => toast.error(t('error')),
        },
      );
      return;
    }
    // An unchanged text keeps the follow-up's own (Django keeps it when none is sent).
    const changed = text.trim() !== (current ?? '').trim();
    save.mutate(
      { lead: target, at: when, on, text: changed ? text.trim() : '' },
      {
        onSuccess: () => {
          toast.success(
            t(moving ? 'followUpDialog.moved' : 'followUpDialog.saved', { when: saved }),
          );
          onClose();
        },
        onError: (error) => {
          const code =
            error instanceof ApiError ? (error.body as { code?: unknown } | null)?.code : null;
          toast.error(
            t(
              isVisitConflict(error)
                ? 'visit.isFollowUp'
                : code === 'no_open_lead'
                  ? 'followUpDialog.noOpenLead'
                  : 'error',
            ),
          );
        },
      },
    );
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={
        meetingPicked
          ? name
            ? t('visit.title', { name: named(name) })
            : t('visit.titleNew')
          : lead
            ? t(moving ? 'followUpDialog.moveTitle' : 'followUpDialog.setTitle', {
                name: named(lead.name),
              })
            : t('followUpDialog.title')
      }
      subtitle={t(meetingPicked ? 'visit.subtitle' : 'followUpDialog.subtitle')}
      closeLabel={t('close')}
      {...(meeting !== null ? { size: 'wide' as const } : {})}
      footer={
        meeting !== null ? (
          <Suspense fallback={null}>
            <VisitFooter onClose={onClose} />
          </Suspense>
        ) : meetingPicked ? (
          <Button variant="outline" onClick={onClose}>
            {t('cancel')}
          </Button>
        ) : (
          <>
            <Button
              type="submit"
              form="follow-up"
              disabled={save.isPending || createTask.isPending}
            >
              {when && !past
                ? t('followUpDialog.saveAt', { day: f.weekdayName(when), time: f.time(when) })
                : day && !past
                  ? t('followUpDialog.saveOn', { day: f.weekday(day) })
                  : t(moving ? 'followUpDialog.move' : 'followUpDialog.save')}
            </Button>
            <Button variant="outline" onClick={onClose}>
              {t('cancel')}
            </Button>
          </>
        )
      }
    >
      <div className="flex flex-col gap-5">
        {!lead && (
          <CustomerPicker
            value={picked}
            onChange={setPicked}
            noLead={noLead}
            onNoLead={setNoLead}
            error={checked && target === null ? t('followUpDialog.customerRequired') : undefined}
          />
        )}
        {offersMeeting && (
          <ChoiceGroup
            legend={t('visit.kind')}
            look="segmented"
            value={how}
            onChange={setHow}
            options={HOWS.map((value) => ({
              value,
              label: t(value === 'call' ? 'visit.kindCall' : 'visit.kindMeeting'),
            }))}
          />
        )}
        {meetingPicked && meeting === null ? (
          <Notice tone="info">{t('nextStep.pickCustomer')}</Notice>
        ) : meeting !== null ? (
          <Suspense fallback={<SkeletonRows rows={4} />}>
            <VisitForm customer={meeting} onDone={onClose}>
              <FollowUpNow at={moving} text={current} timed={timed} onLog={onLog} />
            </VisitForm>
          </Suspense>
        ) : (
          <form id="follow-up" noValidate onSubmit={submit} className="flex flex-col gap-5">
            <FollowUpNow at={moving} text={current} timed={timed} onLog={onLog} />
            <div className="flex flex-col gap-2.5">
              <span className="text-sm font-semibold text-text-2">{t('followUpDialog.date')}</span>
              <FollowUpWhen
                legend={t('followUpDialog.date')}
                calendar="open"
                follow={follow}
                date={date}
                onChange={(next) => {
                  setFollow(next.follow);
                  if (next.date !== undefined) setDate(next.date);
                }}
              />
              {checked && ((!when && !on) || past) && (
                <p role="alert" className="m-0 text-sm text-danger">
                  {t(past ? 'followUpDialog.past' : 'followUpDialog.dateRequired')}
                </p>
              )}
            </div>
            <TextAreaField
              label={t('followUpDialog.text')}
              placeholder={t('followUpDialog.textPlaceholder')}
              value={text}
              onChange={(event) => setText(event.target.value)}
              rows={2}
            />
          </form>
        )}
      </div>
    </Dialog>
  );
}
