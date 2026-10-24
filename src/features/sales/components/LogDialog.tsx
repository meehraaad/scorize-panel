import { useState, type SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { buttonClass } from '@/components/ui/buttonStyles';
import { ChoiceGroup, SelectField, TextAreaField } from '@/components/ui/Choices';
import { DatePicker } from '@/components/ui/DatePicker';
import { Dialog } from '@/components/ui/Dialog';
import { Icon } from '@/components/ui/Icon';
import { Notice } from '@/components/ui/Notice';
import { useFormat } from '@/lib/i18n/useFormat';
import {
  LOST_REASONS,
  STAGES,
  messageHref,
  type Channel,
  type LeadStage,
  type LostReason,
} from '@/lib/sales/api';
import { useLogContact, type CallOutcome, type CustomerData } from '../api';
import { fromLocalInput, quickWhen } from '@/lib/when';

export interface LogStart {
  channel: Channel;
  /** Logging this consultation session. */
  reservation?: number | undefined;
}

const CHANNELS = [
  'call',
  'whatsapp',
  'telegram',
  'sms',
  'meeting',
] as const satisfies readonly Channel[];
const OUTCOMES = [
  'talked',
  'no_answer',
  'call_later',
  'wrong_number',
] as const satisfies readonly CallOutcome[];
const FOLLOWS = ['evening', 'tomorrow', 'three', 'week', 'other'] as const;
type Follow = (typeof FOLLOWS)[number];
/** Stages a contact can move a lead to (drafts and contracts come from the offer page). */
const MOVABLE = ['contacted', 'consulted', 'offer', 'lost'] as const satisfies readonly LeadStage[];
type StageChoice = 'keep' | (typeof MOVABLE)[number];

const isMessage = (channel: Channel) =>
  channel === 'whatsapp' || channel === 'telegram' || channel === 'sms';

/**
 * Log a contact in a few taps: how, what happened, where the lead goes next and when to follow up.
 * A message opens the app with a ready text and records it. Canvas "ثبت سریع تماس".
 */
export function LogDialog({
  customer,
  start,
  onClose,
}: {
  customer: CustomerData;
  start: LogStart | null;
  onClose: () => void;
}) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const log = useLogContact(customer.id);
  const lead = customer.lead;
  const [channel, setChannel] = useState<Channel>(start?.channel ?? 'call');
  const [outcome, setOutcome] = useState<CallOutcome>('talked');
  const [stage, setStage] = useState<StageChoice>('keep');
  const [lostReason, setLostReason] = useState<LostReason | ''>('');
  const [notes, setNotes] = useState('');
  const [follow, setFollow] = useState<Follow>('tomorrow');
  const [date, setDate] = useState('');
  const [email, setEmail] = useState(false);
  const [template, setTemplate] = useState(String(customer.templates[0]?.id ?? ''));
  const [checked, setChecked] = useState(false);

  const message = isMessage(channel);
  const call = channel === 'call';
  const noAnswer = call && outcome === 'no_answer';
  const talked = !call || outcome === 'talked' || outcome === 'call_later';
  const lost = talked && stage === 'lost';
  const asksFollowUp = !noAnswer && !lost && !(call && outcome === 'wrong_number');
  const followAt = follow === 'other' ? fromLocalInput(date) : quickWhen(follow).toISOString();
  const rank = lead ? STAGES.indexOf(lead.stage) : -1;
  const stages = MOVABLE.filter((value) => value === 'lost' || STAGES.indexOf(value) > rank);
  const chosen = customer.templates.find((item) => String(item.id) === template);

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setChecked(true);
    if ((lost && !lostReason) || (asksFollowUp && !followAt)) return;
    // Open the app first: a window opened after the request would be blocked as a popup.
    if (isMessage(channel))
      window.open(messageHref(channel, customer.phone, chosen?.text), '_blank', 'noreferrer');
    log.mutate(
      {
        channel,
        ...(call ? { outcome } : {}),
        ...(talked && stage !== 'keep' ? { stage } : {}),
        ...(lost && lostReason ? { lost_reason: lostReason } : {}),
        notes: notes.trim() || (message ? (chosen?.title ?? '') : ''),
        follow_up_at: asksFollowUp ? followAt : null,
        email_summary: email,
        ...(message && chosen ? { template: chosen.id } : {}),
        ...(start?.reservation ? { reservation: start.reservation } : {}),
        follow_up_text: noAnswer
          ? t('customer.logDialog.retryTask')
          : notes.trim() || t('customer.logDialog.followTask'),
      },
      { onSuccess: onClose },
    );
  };

  return (
    <Dialog
      open={start !== null}
      onClose={onClose}
      title={t('customer.logDialog.title', { name: customer.name })}
      subtitle={
        lead &&
        t('customer.logDialog.subtitle', {
          source: t(`source.${lead.source}`),
          stage: t(`stage.${lead.stage}`),
        })
      }
      closeLabel={t('close')}
      footer={
        <>
          <Button type="submit" form="contact-log" disabled={log.isPending}>
            {message
              ? t('customer.logDialog.send')
              : lost
                ? t('customer.logDialog.saveLost')
                : t('customer.logDialog.save')}
          </Button>
          <Button variant="outline" onClick={onClose}>
            {t('cancel')}
          </Button>
        </>
      }
    >
      <form id="contact-log" noValidate onSubmit={submit} className="flex flex-col gap-6">
        <ChoiceGroup
          legend={t('customer.logDialog.channel')}
          value={channel}
          onChange={setChannel}
          options={CHANNELS.map((value) => ({ value, label: t(`channel.${value}`) }))}
        />

        {call && (
          <a href={`tel:${customer.phone}`} className={buttonClass('outline', 'self-start')}>
            <Icon name="phone" size={18} />
            <span dir="ltr">{f.digits(customer.phone)}</span>
          </a>
        )}

        {message && customer.templates.length > 0 && (
          <ChoiceGroup
            legend={t('customer.logDialog.template')}
            look="tiles"
            value={template}
            onChange={setTemplate}
            hint={t('customer.logDialog.templateHint')}
            options={customer.templates.map((item) => ({
              value: String(item.id),
              label: item.title,
              hint: item.text,
            }))}
          />
        )}

        {call && (
          <ChoiceGroup
            legend={t('customer.logDialog.outcome')}
            look="tiles"
            value={outcome}
            onChange={setOutcome}
            options={OUTCOMES.map((value) => ({
              value,
              label: t(`customer.logDialog.outcomeOption.${value}`),
            }))}
          />
        )}
        {noAnswer && (
          <Notice tone="info">
            {customer.supports.no_answer_sms
              ? t('customer.logDialog.noAnswer')
              : t('customer.logDialog.noAnswerToday')}
          </Notice>
        )}

        {talked && lead && customer.supports.stages && (
          <SelectField
            label={t('customer.logDialog.nextStage')}
            value={stage}
            onChange={setStage}
            options={[
              {
                value: 'keep',
                label: t('customer.logDialog.keepStage', { stage: t(`stage.${lead.stage}`) }),
              },
              ...stages.map((value) => ({ value, label: t(`stage.${value}`) })),
            ]}
          />
        )}
        {lost && (
          <SelectField
            label={t('customer.logDialog.lostReason')}
            value={lostReason}
            onChange={setLostReason}
            error={checked && !lostReason ? t('customer.logDialog.lostReason') : undefined}
            options={[
              { value: '', label: t('customer.logDialog.choose') },
              ...LOST_REASONS.map((value) => ({ value, label: t(`lost.${value}`) })),
            ]}
          />
        )}
        {!noAnswer && (
          <TextAreaField
            label={t('customer.logDialog.notes')}
            placeholder={t('customer.logDialog.notesPlaceholder')}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        )}

        {asksFollowUp && (
          <ChoiceGroup
            legend={t('customer.logDialog.followUp')}
            value={follow}
            onChange={setFollow}
            options={FOLLOWS.map((value) => ({
              value,
              label: t(`customer.logDialog.followOption.${value}`),
            }))}
            hint={
              followAt &&
              t('customer.logDialog.followNote', {
                when: t('customer.logDialog.followWhen', {
                  day: f.weekday(followAt),
                  time: f.time(followAt),
                }),
              })
            }
          />
        )}
        {asksFollowUp && follow === 'other' && (
          <DatePicker
            time
            only="future"
            label={t('customer.logDialog.followDate')}
            value={date}
            onChange={setDate}
            error={checked && !followAt ? t('customer.logDialog.followDate') : undefined}
          />
        )}

        {customer.email && !message && (
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-[15px]">
            <input
              type="checkbox"
              checked={email}
              onChange={(event) => setEmail(event.target.checked)}
              className="size-[18px] accent-primary"
            />
            {t('customer.logDialog.emailSummary')}
          </label>
        )}
        {log.isError && <Notice tone="error">{t('error')}</Notice>}
      </form>
    </Dialog>
  );
}
