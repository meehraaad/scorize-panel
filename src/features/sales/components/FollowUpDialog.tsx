import { useState, type SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { TextAreaField } from '@/components/ui/Choices';
import { Dialog } from '@/components/ui/Dialog';
import { ApiError } from '@/lib/api/client';
import { toValue } from '@/lib/calendar';
import { toast } from '@/lib/toast';
import { useSetFollowUp, type LeadMatch } from '../api';
import { CustomerPicker } from './CustomerPicker';
import { followAtOf, type Follow } from '../followUp';
import { FollowUpNow } from './FollowUpNow';
import { FollowUpWhen } from './FollowUpWhen';
import { useFormat } from '@/lib/i18n/useFormat';
import { useDisplayName } from '@/lib/i18n/useDisplayName';

/**
 * Set a customer's next follow-up without logging a contact: a new one at a picked time (the
 * seller finds the customer), or a customer's follow-up moved to another time (`lead` given: the
 * keyboard and phone way to move a call, besides dragging it). The time is picked the same way as
 * in the contact log (FollowUpWhen). A seller who did talk to the customer logs it instead
 * (`onLog`), so the follow-up is closed with what happened.
 */
export function FollowUpDialog({
  open,
  onClose,
  at,
  lead,
  current,
  timed = true,
  onLog,
}: {
  open: boolean;
  onClose: () => void;
  /** The time to start from (a picked spot, or the call's time). */
  at: Date | null;
  lead?: { id: number; name: string } | undefined;
  /** The open follow-up's text: shown on top and the text field's start. */
  current?: string | undefined;
  /** False: the follow-up has a day but no hour (`at` is its 23:59): no time is picked for it. */
  timed?: boolean | undefined;
  /** "I talked to them": opens the contact log instead. */
  onLog?: (() => void) | undefined;
}) {
  const { t } = useTranslation('sales');
  const named = useDisplayName();
  const f = useFormat();
  const save = useSetFollowUp();
  const [picked, setPicked] = useState<LeadMatch | null>(null);
  const start = timed ? at : null;
  const [follow, setFollow] = useState<Follow>(start ? 'other' : 'tomorrow');
  const [date, setDate] = useState(() => (start ? toValue(start, true) : ''));
  const [text, setText] = useState(current ?? '');
  const [checked, setChecked] = useState(false);
  const [openedAt] = useState(() => Date.now());
  const target = lead?.id ?? picked?.id ?? null;
  const name = lead?.name ?? picked?.name ?? '';
  const when = followAtOf(follow, date);
  const past = when !== null && new Date(when).getTime() < openedAt;
  /** Moving the customer's follow-up: the time it has now. */
  const moving = lead ? at : null;

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setChecked(true);
    if (target === null || !when || past) return;
    // An unchanged text keeps the follow-up's own (Django keeps it when none is sent).
    const changed = text.trim() !== (current ?? '').trim();
    save.mutate(
      { lead: target, at: when, text: changed ? text.trim() : '' },
      {
        onSuccess: () => {
          toast.success(
            t(moving ? 'followUpDialog.moved' : 'followUpDialog.saved', {
              when: t('followUpDialog.when', { day: f.weekday(when), time: f.time(when) }),
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

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={
        lead
          ? t(moving ? 'followUpDialog.moveTitle' : 'followUpDialog.setTitle', {
              name: named(lead.name),
            })
          : t('followUpDialog.title')
      }
      subtitle={t('followUpDialog.subtitle')}
      closeLabel={t('close')}
      footer={
        <>
          <Button type="submit" form="follow-up" disabled={save.isPending}>
            {when && !past
              ? t('followUpDialog.saveAt', { day: f.weekdayName(when), time: f.time(when) })
              : t(moving ? 'followUpDialog.move' : 'followUpDialog.save')}
          </Button>
          <Button variant="outline" onClick={onClose}>
            {t('cancel')}
          </Button>
        </>
      }
    >
      <form id="follow-up" noValidate onSubmit={submit} className="flex flex-col gap-5">
        <FollowUpNow at={moving} text={current} timed={timed} onLog={onLog} />
        {!lead && (
          <CustomerPicker
            value={picked}
            onChange={setPicked}
            error={checked && target === null ? t('followUpDialog.customerRequired') : undefined}
          />
        )}
        <div className="flex flex-col gap-2.5">
          <span className="text-sm font-semibold text-text-2">{t('followUpDialog.date')}</span>
          <FollowUpWhen
            legend={t('followUpDialog.date')}
            name={name}
            follow={follow}
            date={date}
            onChange={(next) => {
              setFollow(next.follow);
              if (next.date !== undefined) setDate(next.date);
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
    </Dialog>
  );
}
