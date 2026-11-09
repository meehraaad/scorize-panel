import { Fragment, useId, useState, type ReactNode, type SubmitEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { buttonClass } from '@/components/ui/buttonStyles';
import { ChoiceGroup, SelectField } from '@/components/ui/Choices';
import { FloatingPanel } from '@/components/ui/FloatingPanel';
import {
  updateContactDraft,
  type ContactDraft,
  type ContactValues,
  type LogSession,
  type StageChoice,
} from '@/lib/sales/contactDrafts';
import { Icon } from '@/components/ui/Icon';
import { InlineConfirm } from '@/components/ui/InlineConfirm';
import { Notice } from '@/components/ui/Notice';
import { useFormat } from '@/lib/i18n/useFormat';
import { LOST_REASONS, messageHref, type Channel } from '@/lib/sales/api';
import { useLogContact, type CallOutcome, type CustomerData } from '../api';
import { fromLocalInput, quickWhen } from '@/lib/when';
import { toast } from '@/lib/toast';
import { CallBrief } from './CallBrief';
import { CallSteps, CallStrip } from './CallStrip';
import { Dialog } from '@/components/ui/Dialog';
import { customerPath } from '../paths';
import { FollowUpSlots } from './FollowUpSlots';
import { ProfileChips } from './ProfileChips';
import { laneOf, lanesOf, movableLanes, pickedLane } from '../boardLanes';
import { StageStrip } from './StageStrip';
import { transcribeVoice, voiceCapabilityQuery } from '@/lib/sales/voice';
import { useVoiceOwner } from '@/lib/voice/lease';
import { VoiceTextAreaField } from '@/components/voice/VoiceField';

/** How a contact happened, picked by hand (a message is logged from the message buttons). */
const CHANNELS = ['call', 'meeting'] as const satisfies readonly Channel[];
const OUTCOMES = [
  'talked',
  'no_answer',
  'call_later',
  'wrong_number',
] as const satisfies readonly CallOutcome[];
/** Quick follow-up times; any other is a pick on the calendar (`other`). */
const FOLLOWS = ['evening', 'tomorrow', 'three'] as const;

const isMessage = (channel: Channel) =>
  channel === 'whatsapp' || channel === 'telegram' || channel === 'sms';

/**
 * Log a contact in a few taps: how, what happened, where the lead goes next and when to follow up.
 * A message opens the app with a ready text and records it. Canvas "ثبت سریع تماس".
 * A consultation's log (a reservation) is the seller's main form: it names the session on top,
 * skips the channel and walks through three numbered steps.
 */
export function LogDialog({
  active,
  customer,
  draft,
  onClose,
  onSaved,
  onDiscard,
}: {
  active: boolean;
  customer: CustomerData;
  draft: ContactDraft;
  onSaved: () => void;
  onDiscard: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation(['sales', 'voice']);
  const { t: tSales } = useTranslation('sales');
  const f = useFormat();
  const formId = useId();
  const log = useLogContact(customer.id);
  const voice = useQuery({ ...voiceCapabilityQuery, enabled: active });
  const voiceBusy = useVoiceOwner() !== null;
  const lead = customer.lead;
  const { start, values } = draft;
  const {
    channel,
    outcome,
    stage: picked,
    lostReason,
    notes,
    customerSummary = '',
    follow,
    date,
    email,
    sms = false,
    customerOpen = false,
  } = values;
  const template = values.template ?? String(customer.templates[0]?.id ?? '');
  const change =
    <K extends keyof ContactValues>(key: K) =>
    (value: ContactValues[K]) =>
      updateContactDraft(draft.key, { [key]: value });
  const [checked, setChecked] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [picking, setPicking] = useState(false);
  /** A live (or just ended) office call: the channel is the phone and the strip names the call. */
  const liveCall = draft.call;

  const message = isMessage(channel);
  const call = channel === 'call';
  /** Logging a booked consultation: the channel is fixed. */
  const session = !!start.reservation;
  const noAnswer = call && outcome === 'no_answer';
  const talked = !call || outcome === 'talked' || outcome === 'call_later';
  // The board's lanes, the sales manager's columns included (S48): the log moves the card the
  // board shows, forward only; drafts and contracts come from the offer page.
  const lanes = lanesOf(customer, tSales);
  const currentLane = lead ? laneOf(lanes, lead) : null;
  const movable = lead && lead.stage !== 'lost' ? movableLanes(lanes, currentLane) : [];
  // A session log starts on "consulted" (its first column); a lead already past it keeps its lane.
  const target = picked === 'keep' || picked === 'lost' ? null : pickedLane(lanes, picked);
  const stage: StageChoice =
    picked === 'lost'
      ? 'lost'
      : target && movable.includes(target)
        ? (target.key as StageChoice)
        : 'keep';
  const lost = talked && stage === 'lost';
  const asksFollowUp = !noAnswer && !lost && !(call && outcome === 'wrong_number');
  const followAt = follow === 'other' ? fromLocalInput(date) : quickWhen(follow).toISOString();
  const chosen = customer.templates.find((item) => String(item.id) === template);

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (log.isPending || voiceBusy) return;
    setChecked(true);
    if ((lost && !lostReason) || (asksFollowUp && !followAt)) return;
    // Open the app first: a window opened after the request would be blocked as a popup.
    if (isMessage(channel))
      window.open(messageHref(channel, customer.phone, chosen?.text), '_blank', 'noreferrer');
    log.mutate(
      {
        channel,
        ...(call ? { outcome } : {}),
        ...(talked && lost ? { stage: 'lost' as const } : {}),
        ...(talked && target && stage !== 'keep' && !lost
          ? { stage: target.stage, ...(target.column !== null ? { column: target.column } : {}) }
          : {}),
        ...(lost && lostReason ? { lost_reason: lostReason } : {}),
        notes: notes.trim() || (message ? (chosen?.title ?? '') : ''),
        follow_up_at: asksFollowUp ? followAt : null,
        customer_summary: noAnswer ? '' : customerSummary.trim(),
        email_summary: !noAnswer && email && !!customerSummary.trim(),
        ...(customer.supports.summary_sms
          ? { sms_summary: !noAnswer && sms && !!customerSummary.trim() }
          : {}),
        ...(message && chosen ? { template: chosen.id } : {}),
        ...(start.reservation ? { reservation: start.reservation } : {}),
        follow_up_text: noAnswer
          ? t('customer.logDialog.retryTask')
          : notes.trim() || t('customer.logDialog.followTask'),
      },
      {
        onError: () => toast.error(t('error')),
        onSuccess: () => {
          toast.success(t('contactDraft.saved'));
          onSaved();
        },
      },
    );
  };

  const notesField = (
    <VoiceTextAreaField
      label={t(session ? 'customer.logDialog.meetingNotes' : 'customer.logDialog.notes')}
      placeholder={t(
        session
          ? 'customer.logDialog.meetingNotesPlaceholder'
          : 'customer.logDialog.notesPlaceholder',
      )}
      hint={session ? t('customer.logDialog.privateHint') : undefined}
      rows={session ? 4 : 2}
      maxLength={5000}
      value={notes}
      onChange={change('notes')}
      transcribe={transcribeVoice}
      voiceEnabled={active && !log.isPending && !!voice.data?.enabled}
      disabled={log.isPending}
      pendingTranscript={values.voiceTranscript}
      onPendingTranscriptChange={change('voiceTranscript')}
    />
  );
  const customerFields =
    !session && !customerSummary && !customerOpen ? (
      <button
        type="button"
        onClick={() => change('customerOpen')(true)}
        className="-my-2 inline-flex min-h-11 items-center gap-1.5 self-start text-[13px] font-semibold text-primary-text hover:underline"
      >
        <Icon name="plus" size={16} />
        {t('customer.logDialog.addCustomerNote')}
      </button>
    ) : (
      <div className="flex flex-col gap-1 rounded-card border border-hair bg-row-highlight p-3">
        <VoiceTextAreaField
          label={t('customer.logDialog.customerSummary')}
          hint={t('customer.logDialog.customerSummaryHint')}
          value={customerSummary}
          onChange={change('customerSummary')}
          rows={2}
          maxLength={5000}
          transcribe={transcribeVoice}
          voiceEnabled={active && !log.isPending && !!voice.data?.enabled}
          disabled={log.isPending}
          pendingTranscript={values.customerSummaryVoiceTranscript}
          onPendingTranscriptChange={change('customerSummaryVoiceTranscript')}
        />
        {!message && (customer.email || customer.supports.summary_sms) && (
          <div className="flex flex-wrap gap-x-5">
            {customer.email && (
              <label className="flex min-h-11 cursor-pointer items-center gap-2 text-[13px] text-text-2">
                <input
                  type="checkbox"
                  checked={email}
                  disabled={!customerSummary.trim()}
                  onChange={(event) => change('email')(event.target.checked)}
                  className="size-[18px] accent-primary"
                />
                {t('customer.logDialog.emailSummary')}
              </label>
            )}
            {customer.supports.summary_sms && (
              <label className="flex min-h-11 cursor-pointer items-center gap-2 text-[13px] text-text-2">
                <input
                  type="checkbox"
                  checked={sms}
                  disabled={!customerSummary.trim()}
                  onChange={(event) => change('sms')(event.target.checked)}
                  className="size-[18px] accent-primary"
                />
                {t('customer.logDialog.smsSummary')}
              </label>
            )}
          </div>
        )}
      </div>
    );
  const asksStage = talked && !!lead && customer.supports.stages;
  const nextFields = (
    <>
      {asksStage && (
        <StageStrip
          lanes={lanes}
          current={currentLane}
          movable={movable}
          lostAllowed
          value={stage}
          onChange={change('stage')}
        />
      )}
      {lost && (
        <SelectField
          label={t('customer.logDialog.lostReason')}
          value={lostReason}
          onChange={change('lostReason')}
          error={checked && !lostReason ? t('customer.logDialog.lostReason') : undefined}
          options={[
            { value: '', label: t('customer.logDialog.choose') },
            ...LOST_REASONS.map((value) => ({ value, label: t(`lost.${value}`) })),
          ]}
        />
      )}
      {asksFollowUp && (
        <ChoiceGroup
          legend={t('customer.logDialog.followUp')}
          hideLegend
          value={follow}
          onChange={change('follow')}
          options={FOLLOWS.map((value) => ({
            value,
            label: t(`customer.logDialog.followOption.${value}`),
          }))}
          extra={
            <button
              type="button"
              onClick={() => setPicking(true)}
              aria-pressed={follow === 'other'}
              className={`inline-flex min-h-11 flex-none items-center gap-1.5 rounded-full px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${
                follow === 'other' && followAt
                  ? 'bg-hero text-on-hero'
                  : 'text-primary-text shadow-[inset_0_0_0_1px_var(--primary)] hover:bg-tint'
              }`}
            >
              <Icon name="calendar" size={16} />
              {follow === 'other' && followAt
                ? t('customer.logDialog.followWhen', {
                    day: f.weekdayName(followAt),
                    time: f.time(followAt),
                  })
                : t('customer.logDialog.fromCalendar')}
            </button>
          }
        />
      )}
      {asksFollowUp && checked && !followAt && (
        <p role="alert" className="m-0 -mt-2 text-sm text-danger">
          {t('customer.logDialog.followDate')}
        </p>
      )}
      <Dialog
        open={picking}
        onClose={() => setPicking(false)}
        size="wide"
        title={t('customer.logDialog.calendarTitle', { name: customer.name })}
        subtitle={t('customer.logDialog.calendarHint')}
        closeLabel={t('close')}
      >
        {picking && (
          <FollowUpSlots
            value={date}
            onChange={(value) => {
              updateContactDraft(draft.key, { follow: 'other', date: value });
              setPicking(false);
            }}
          />
        )}
      </Dialog>
    </>
  );
  const contactFields = (
    <>
      {!liveCall && (
        <ChoiceGroup
          legend={t('customer.logDialog.channel')}
          value={channel}
          onChange={change('channel')}
          options={CHANNELS.map((value) => ({
            value,
            label: t(`customer.logDialog.channelOption.${value}`),
          }))}
        />
      )}
      {call && !liveCall && (
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
          onChange={change('template')}
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
          hideLegend
          look="segmented"
          value={outcome}
          onChange={change('outcome')}
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
    </>
  );
  const steps: { key: string; title: string; body: ReactNode }[] = session
    ? [
        { key: 'meeting', title: t('customer.logDialog.step.meeting'), body: notesField },
        { key: 'customer', title: t('customer.logDialog.step.customer'), body: customerFields },
      ]
    : [
        { key: 'contact', title: t('customer.logDialog.step.contact'), body: contactFields },
        ...(noAnswer
          ? []
          : [
              {
                key: 'notes',
                title: t('customer.logDialog.step.notes'),
                body: (
                  <>
                    {notesField}
                    {customerFields}
                  </>
                ),
              },
            ]),
      ];
  if (asksStage || lost || asksFollowUp)
    steps.push({ key: 'next', title: t('customer.logDialog.step.next'), body: nextFields });

  /** What we know about the customer, on the strip: the brief, then the profile chips. */
  const about = (dark: boolean) => (
    <>
      {!start.via && customer.supports.call_brief && (
        <CallBrief customer={customer.id} live={!!liveCall} dark={dark} />
      )}
      <ProfileChips customer={customer.id} dark={dark} />
    </>
  );
  /** The lead's lane as the board names it (a team column's own name). */
  const stageName = lead ? (currentLane?.name ?? t(`stage.${lead.stage}`)) : '';
  const chips = lead ? [stageName] : [];
  return (
    <FloatingPanel
      active={active}
      onClose={onClose}
      wide
      hero={
        liveCall
          ? (titleId) => (
              <CallStrip
                call={liveCall}
                titleId={titleId}
                name={customer.name}
                face={customer.face}
                href={customerPath(customer.id)}
                chips={chips}
                notLogged
                closeLabel={t('contactDraft.minimize')}
                onClose={onClose}
              >
                {about(liveCall.ended_at === null)}
              </CallStrip>
            )
          : session
            ? undefined
            : (titleId) => (
                <CallStrip
                  phone={customer.phone}
                  label={t('customer.logDialog.stripLabel')}
                  titleLabel={t('customer.logDialog.title', { name: customer.name })}
                  titleId={titleId}
                  name={customer.name}
                  face={customer.face}
                  href={customerPath(customer.id)}
                  chips={chips}
                  closeLabel={t('contactDraft.minimize')}
                  onClose={onClose}
                >
                  {about(true)}
                </CallStrip>
              )
      }
      icon={session ? 'calendar' : undefined}
      title={t(session ? 'customer.logDialog.meetingTitle' : 'customer.logDialog.title', {
        name: customer.name,
      })}
      subtitle={
        lead &&
        t('customer.logDialog.subtitle', {
          source: t(`source.${lead.source}`),
          stage: stageName,
        })
      }
      summary={session && start.session && <SessionSummary session={start.session} />}
      closeLabel={t('contactDraft.minimize')}
      footer={
        confirmDiscard ? (
          <InlineConfirm
            message={t('contactDraft.discardConfirm')}
            confirmLabel={t('contactDraft.discard')}
            cancelLabel={t('contactDraft.keep')}
            pending={log.isPending}
            onConfirm={onDiscard}
            onCancel={() => setConfirmDiscard(false)}
          />
        ) : (
          <>
            <Button
              type="submit"
              form={formId}
              size="lg"
              disabled={log.isPending || voiceBusy}
              className="min-w-0 flex-1"
            >
              <Icon name={message ? 'send' : 'check'} size={20} />
              <span className="truncate">
                {message
                  ? t('customer.logDialog.send')
                  : lost
                    ? t('customer.logDialog.saveLost')
                    : session
                      ? t('customer.logDialog.saveMeeting')
                      : asksFollowUp && followAt
                        ? t('customer.logDialog.saveWithFollow', {
                            day: f.weekdayName(followAt),
                            time: f.time(followAt),
                          })
                        : t('customer.logDialog.save')}
              </span>
            </Button>
            <Button
              variant="danger"
              size="lg"
              disabled={log.isPending}
              onClick={() => setConfirmDiscard(true)}
              aria-label={t('contactDraft.discard')}
              className="px-4"
            >
              <Icon name="trash" size={18} />
              <span className="hidden sm:inline">{t('contactDraft.discard')}</span>
            </Button>
          </>
        )
      }
    >
      <form id={formId} noValidate onSubmit={submit} className="flex flex-col gap-5">
        {liveCall && start.via && (
          <CallSteps
            step={2}
            done={t(start.via === 'new' ? 'callStrip.created' : 'callStrip.found')}
          />
        )}
        <fieldset disabled={log.isPending} className="contents">
          {session
            ? steps.map((step, index) => (
                <Step key={step.key} number={index + 1} title={step.title}>
                  {step.body}
                </Step>
              ))
            : steps.map((step) => <Fragment key={step.key}>{step.body}</Fragment>)}
        </fieldset>
      </form>
    </FloatingPanel>
  );
}

/** One numbered part of the form: a short heading and its fields. */
function Step({ number, title, children }: { number: number; title: string; children: ReactNode }) {
  const f = useFormat();
  const id = useId();
  return (
    <section
      aria-labelledby={id}
      className={`flex flex-col gap-5 ${number > 1 ? 'border-t border-hair pt-6' : ''}`}
    >
      <h3 id={id} className="m-0 flex items-center gap-3 font-display text-base font-bold">
        <span
          aria-hidden="true"
          className="inline-flex size-8 flex-none items-center justify-center rounded-full bg-tint text-sm text-primary-text"
        >
          {f.number(number)}
        </span>
        {title}
      </h3>
      {children}
    </section>
  );
}

/** Which consultation is being logged: type, day and time, length and how it was held. */
function SessionSummary({ session }: { session: LogSession }) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const facts = [
    t('customer.logDialog.sessionWhen', {
      day: f.weekday(session.starts_at),
      time: f.time(session.starts_at),
    }),
    ...(session.minutes
      ? [t('customer.logDialog.sessionMinutes', { n: f.number(session.minutes) })]
      : []),
    ...(session.mode ? [t(`mode.${session.mode}`)] : []),
  ];
  return (
    <div className="flex items-start gap-3 rounded-xl bg-surface px-4 py-3 shadow-[inset_0_0_0_1px_var(--hair)]">
      <Icon
        name={session.mode === 'in_person' ? 'building' : 'video'}
        size={20}
        className="mt-0.5 flex-none text-primary-text"
      />
      <div className="flex min-w-0 flex-col gap-0.5">
        {session.title && <span className="text-[15px] font-semibold">{session.title}</span>}
        <span className="text-sm leading-6 text-text-2">{facts.join(' · ')}</span>
      </div>
    </div>
  );
}
