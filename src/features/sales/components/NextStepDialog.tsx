import { useState, type SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { ChoiceGroup, TextAreaField } from '@/components/ui/Choices';
import { Dialog } from '@/components/ui/Dialog';
import { Notice } from '@/components/ui/Notice';
import { ApiError } from '@/lib/api/client';
import { toValue } from '@/lib/calendar';
import { useDisplayName } from '@/lib/i18n/useDisplayName';
import { useFormat } from '@/lib/i18n/useFormat';
import { toast } from '@/lib/toast';
import { useSetFollowUp, type LeadMatch } from '../api';
import { useVisitBookable } from '../api/visits';
import { followAtOf, type Follow } from '../followUp';
import { CustomerPicker } from './CustomerPicker';
import { FollowUpNow } from './FollowUpNow';
import { FollowUpWhen } from './FollowUpWhen';
import { VisitBody, VisitFooter } from './VisitBooking';

const FORM = 'follow-up';
/** A day-only follow-up being moved starts on its day at this hour, if the hour is turned on. */
const DAY_HOUR = 10;

export type NextStepMode = 'follow' | 'visit';

/**
 * Who the next step is with: their open lead (a follow-up is set on it) and the customer (an
 * office meeting is theirs). One of them may be missing: then that tab isn't offered.
 */
export interface NextStepWho {
  lead?: number | undefined;
  customer?: number | undefined;
  name: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** Given: the customer's own window. Absent: the seller finds the customer first. */
  who?: NextStepWho | undefined;
  /** The time to start from (a picked spot, or the follow-up's time when moving it). */
  at: Date | null;
  /** The open follow-up's text: shown on top and the text field's start. */
  current?: string | undefined;
  /** False: the follow-up has a day but no hour (`at` is its 23:59). */
  timed?: boolean | undefined;
  /** "I talked to them": opens the contact log instead. */
  onLog?: (() => void) | undefined;
}

/**
 * The customer's next step, in one window with two tabs: a follow-up (a call or message at a time,
 * or on a day with no hour) or an in-person meeting at the office. The seller switches either way
 * and the customer stays. A follow-up is set without logging a contact: a new one at a picked time,
 * or the customer's follow-up moved (`who` and `at`: the keyboard and phone way to move a call,
 * besides dragging it). A seller who did talk to the customer logs it instead (`onLog`).
 */
export function NextStepDialog({
  mode: first = 'follow',
  ...props
}: Props & { mode?: NextStepMode | undefined }) {
  const { t } = useTranslation('sales');
  const named = useDisplayName();
  const [mode, setMode] = useState<NextStepMode>(first);
  const [picked, setPicked] = useState<LeadMatch | null>(null);
  const { open, onClose, who, at, current, timed = true, onLog } = props;
  const target: NextStepWho | null =
    who ?? (picked ? { lead: picked.id, customer: picked.customer, name: picked.name } : null);
  const name = target ? named(target.name) : '';
  // Each tab needs its own record: a follow-up the lead, a meeting the customer.
  const tabs = !who || (who.lead !== undefined && who.customer !== undefined);
  const customer = target?.customer ?? null;
  const bookable = useVisitBookable(customer, open && mode === 'visit');
  const follow = useFollowForm({ ...props, timed, target, picking: !who });
  /** Moving the customer's follow-up: the time it has now. */
  const moving = who ? at : null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size={mode === 'visit' ? 'wide' : 'panel'}
      title={
        mode === 'visit'
          ? target
            ? t('visit.title', { name })
            : t('visit.titleNew')
          : who
            ? t(moving ? 'followUpDialog.moveTitle' : 'followUpDialog.setTitle', { name })
            : t('followUpDialog.title')
      }
      subtitle={t(mode === 'visit' ? 'visit.subtitle' : 'followUpDialog.subtitle')}
      closeLabel={t('close')}
      footer={
        mode === 'follow' ? (
          follow.footer
        ) : bookable ? (
          <VisitFooter onClose={onClose} />
        ) : (
          <Button variant="outline" onClick={onClose}>
            {t('close')}
          </Button>
        )
      }
    >
      {tabs && (
        <ChoiceGroup
          legend={t('nextStep.kind')}
          hideLegend
          look="segmented"
          value={mode}
          onChange={setMode}
          options={(['follow', 'visit'] as const).map((value) => ({
            value,
            label: t(`nextStep.${value}`),
          }))}
        />
      )}
      <FollowUpNow at={moving} text={current} timed={timed} onLog={onLog} />
      {!who && (
        <CustomerPicker
          value={picked}
          onChange={setPicked}
          error={
            follow.checked && target === null ? t('followUpDialog.customerRequired') : undefined
          }
        />
      )}
      {mode === 'follow' ? (
        follow.form
      ) : customer === null ? (
        <Notice tone="info">{t('nextStep.pickCustomer')}</Notice>
      ) : (
        <VisitBody key={customer} customer={customer} onDone={onClose} />
      )}
    </Dialog>
  );
}

/** The follow-up tab: its time, its text, and the footer that saves it. */
function useFollowForm({
  onClose,
  at,
  current,
  timed,
  target,
  picking,
}: Props & { timed: boolean; target: NextStepWho | null; picking: boolean }) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const save = useSetFollowUp();
  const [follow, setFollow] = useState<Follow>(at ? 'other' : 'tomorrow');
  const [date, setDate] = useState(() => {
    if (!at) return '';
    if (timed) return toValue(at, true);
    const day = new Date(at);
    day.setHours(DAY_HOUR, 0, 0, 0);
    return toValue(day, true);
  });
  const [dateOnly, setDateOnly] = useState(!!at && !timed);
  const [text, setText] = useState(current ?? '');
  const [checked, setChecked] = useState(false);
  const [openedAt] = useState(() => Date.now());
  const lead = target?.lead ?? null;
  const when = followAtOf(follow, date, dateOnly);
  const past = when !== null && new Date(when).getTime() < openedAt;
  const moving = !picking && at !== null;

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setChecked(true);
    if (lead === null || !when || past) return;
    // An unchanged text keeps the follow-up's own (Django keeps it when none is sent).
    const changed = text.trim() !== (current ?? '').trim();
    save.mutate(
      { lead, at: when, text: changed ? text.trim() : '' },
      {
        onSuccess: () => {
          toast.success(
            t(moving ? 'followUpDialog.moved' : 'followUpDialog.saved', {
              when: dateOnly
                ? t('followUpDialog.whenDay', { day: f.weekday(when) })
                : t('followUpDialog.when', { day: f.weekday(when), time: f.time(when) }),
            }),
          );
          onClose();
        },
        onError: (error) => {
          const code =
            error instanceof ApiError ? (error.body as { code?: unknown } | null)?.code : null;
          toast.error(t(code === 'no_open_lead' ? 'followUpDialog.noOpenLead' : 'error'));
        },
      },
    );
  };

  const form = (
    <form id={FORM} noValidate onSubmit={submit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2.5">
        <span className="text-sm font-semibold text-text-2">{t('followUpDialog.date')}</span>
        <FollowUpWhen
          legend={t('followUpDialog.date')}
          calendar="open"
          follow={follow}
          date={date}
          dateOnly={dateOnly}
          onChange={(next) => {
            if (next.follow !== undefined) setFollow(next.follow);
            if (next.date !== undefined) setDate(next.date);
            if (next.dateOnly !== undefined) setDateOnly(next.dateOnly);
          }}
        />
        {checked && (!when || past) && (
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
  );

  const footer = (
    <>
      <Button type="submit" form={FORM} disabled={save.isPending}>
        {when && !past
          ? dateOnly
            ? t('followUpDialog.saveAtDay', { day: f.weekdayName(when) })
            : t('followUpDialog.saveAt', { day: f.weekdayName(when), time: f.time(when) })
          : t(moving ? 'followUpDialog.move' : 'followUpDialog.save')}
      </Button>
      <Button variant="outline" onClick={onClose}>
        {t('cancel')}
      </Button>
    </>
  );

  return { form, footer, checked };
}

/** The next-step window on its follow-up tab (the entry points that set or move a follow-up). */
export function FollowUpDialog(props: Props) {
  return <NextStepDialog {...props} mode="follow" />;
}

/** The next-step window on its office meeting tab (the customer page, the contact log). */
export function VisitDialog({
  followUp,
  customer,
  ...props
}: Omit<Props, 'who' | 'at' | 'current' | 'timed'> & {
  customer: { id: number; name: string; lead?: number | undefined };
  /** The customer's open follow-up, shown above the week (and moved on the follow-up tab). */
  followUp?:
    { at: string; text?: string | undefined; timed?: boolean | undefined } | null | undefined;
}) {
  return (
    <NextStepDialog
      {...props}
      mode="visit"
      who={{ customer: customer.id, lead: customer.lead, name: customer.name }}
      at={followUp ? new Date(followUp.at) : null}
      current={followUp?.text}
      timed={followUp?.timed}
    />
  );
}
