import { useQuery } from '@tanstack/react-query';
import { useState, type SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { ChoiceGroup, TextAreaField } from '@/components/ui/Choices';
import { DatePicker } from '@/components/ui/DatePicker';
import { Dialog } from '@/components/ui/Dialog';
import { TextField } from '@/components/ui/TextField';
import { toValue } from '@/lib/calendar';
import { formatPhone } from '@/lib/site';
import { toast } from '@/lib/toast';
import { fromLocalInput } from '@/lib/when';
import { firstLeadQuery, leadsQuery, useSetFollowUp } from '../api';
import { useFormat } from '@/lib/i18n/useFormat';

/** Leads a follow-up can be set on (the server skips the rest). */
const OPEN = new Set(['new', 'contacted', 'consulted', 'offer']);
const SHOWN = 6;

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
  const [search, setSearch] = useState('');
  const [chosen, setChosen] = useState<string | null>(null);
  const [date, setDate] = useState(() => (at ? toValue(at, true) : ''));
  const [text, setText] = useState('');
  const [checked, setChecked] = useState(false);
  const [openedAt] = useState(() => Date.now());
  const typed = search.trim();
  const found = useQuery({
    ...leadsQuery({ ...firstLeadQuery('all'), search: typed }),
    enabled: open && !lead && typed.length >= 2,
  });
  const rows = (found.data?.results ?? []).filter((row) => OPEN.has(row.stage)).slice(0, SHOWN);
  const target = lead?.id ?? (chosen ? Number(chosen) : null);
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
          <div className="flex flex-col gap-3">
            <TextField
              label={t('followUpDialog.customer')}
              hint={t('followUpDialog.customerHint')}
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setChosen(null);
              }}
              error={checked && target === null ? t('followUpDialog.customerRequired') : undefined}
              autoComplete="off"
            />
            {typed.length >= 2 &&
              !found.isPending &&
              (rows.length ? (
                <ChoiceGroup
                  legend={t('followUpDialog.matches')}
                  hideLegend
                  look="tiles"
                  value={chosen}
                  onChange={setChosen}
                  options={rows.map((row) => ({
                    value: String(row.id),
                    label: row.name,
                    hint: row.phone ? formatPhone(row.phone) : t(`stage.${row.stage}`),
                  }))}
                />
              ) : (
                <p className="m-0 text-sm text-text-2">{t('followUpDialog.noMatch')}</p>
              ))}
          </div>
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
