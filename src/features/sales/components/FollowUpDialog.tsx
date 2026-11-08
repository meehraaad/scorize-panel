import { useState, type SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { TextAreaField } from '@/components/ui/Choices';
import { DatePicker } from '@/components/ui/DatePicker';
import { Dialog } from '@/components/ui/Dialog';
import { toValue } from '@/lib/calendar';
import { toast } from '@/lib/toast';
import { fromLocalInput } from '@/lib/when';
import { useSetFollowUp, type LeadMatch } from '../api';
import { CustomerPicker } from './CustomerPicker';
import { useFormat } from '@/lib/i18n/useFormat';

/**
 * A follow-up set from the calendar: a new one at a picked time (the seller finds the customer),
 * or a customer's follow-up moved to another time (`lead` given: the keyboard and phone way to
 * move a call, besides dragging it).
 */
export function FollowUpDialog({
  open,
  onClose,
  at,
  lead,
}: {
  open: boolean;
  onClose: () => void;
  /** The time to start from (a picked spot, or the call's time). */
  at: Date | null;
  lead?: { id: number; name: string } | undefined;
}) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const save = useSetFollowUp();
  const [picked, setPicked] = useState<LeadMatch | null>(null);
  const [date, setDate] = useState(() => (at ? toValue(at, true) : ''));
  const [text, setText] = useState('');
  const [checked, setChecked] = useState(false);
  const [openedAt] = useState(() => Date.now());
  const target = lead?.id ?? picked?.id ?? null;
  const when = fromLocalInput(date);
  const past = when !== null && new Date(when).getTime() < openedAt;

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setChecked(true);
    if (target === null || !when || past) return;
    save.mutate(
      { lead: target, at: when, text: text.trim() },
      {
        onSuccess: () => {
          toast.success(
            t(lead ? 'followUpDialog.moved' : 'followUpDialog.saved', {
              when: t('followUpDialog.when', { day: f.weekday(when), time: f.time(when) }),
            }),
          );
          onClose();
        },
        onError: () => toast.error(t('error')),
      },
    );
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={lead ? t('followUpDialog.moveTitle', { name: lead.name }) : t('followUpDialog.title')}
      subtitle={t('followUpDialog.subtitle')}
      closeLabel={t('close')}
      footer={
        <>
          <Button type="submit" form="follow-up" disabled={save.isPending}>
            {lead ? t('followUpDialog.move') : t('followUpDialog.save')}
          </Button>
          <Button variant="outline" onClick={onClose}>
            {t('cancel')}
          </Button>
        </>
      }
    >
      <form id="follow-up" noValidate onSubmit={submit} className="flex flex-col gap-5">
        {!lead && (
          <CustomerPicker
            value={picked}
            onChange={setPicked}
            error={checked && target === null ? t('followUpDialog.customerRequired') : undefined}
          />
        )}
        <DatePicker
          time
          only="future"
          minuteStep={15}
          label={t('followUpDialog.date')}
          value={date}
          onChange={setDate}
          error={
            checked && (!when || past)
              ? t(past ? 'followUpDialog.past' : 'followUpDialog.dateRequired')
              : undefined
          }
        />
        {!lead && (
          <TextAreaField
            label={t('followUpDialog.text')}
            placeholder={t('followUpDialog.textPlaceholder')}
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={2}
          />
        )}
      </form>
    </Dialog>
  );
}
