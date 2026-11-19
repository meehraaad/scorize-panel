import {
  Fragment,
  lazy,
  Suspense,
  useId,
  useRef,
  useState,
  type ReactNode,
  type SubmitEvent,
} from 'react';
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
  type NoAnswerSend,
  type StageChoice,
} from '@/lib/sales/contactDrafts';
import { Icon } from '@/components/ui/Icon';
import { InlineConfirm } from '@/components/ui/InlineConfirm';
import { Notice } from '@/components/ui/Notice';
import { useFormat } from '@/lib/i18n/useFormat';
import { useDisplayName } from '@/lib/i18n/useDisplayName';
import { LOST_REASONS, messageHref, type Channel } from '@/lib/sales/api';
import { callHref, useLinphoneDial } from '@/lib/sales/dial';
import { type CallOutcome, type CustomerData } from '../api';
import { useLogContact } from '../api/customerMutations';
import { toast } from '@/lib/toast';
import { CallBrief } from './CallBrief';
import { CallSteps, CallStrip } from './CallStrip';
import { customerPath } from '../paths';
import { useNow } from '../useNow';
import { useSalesFormat } from '../format';
import { ON_SERVER } from '@/lib/applicant/onServer';
import { followAtOf, followOnOf, isVisitConflict, meetingAhead } from '../followUp';
import { FollowUpWhen } from './FollowUpWhen';
import { ProfileChips } from './ProfileChips';
import { laneOf, lanesOf, movableLanes, pickedLane } from '../boardLanes';
import { StageStrip } from './StageStrip';
import { transcribeVoice, voiceCapabilityQuery } from '@/lib/sales/voice';
import { useVoiceOwner } from '@/lib/voice/lease';
import { VoiceTextAreaField } from '@/components/voice/VoiceField';

// Opens on a click: the meeting window (its week of rooms) is not part of the popup's load.
const VisitDialog = lazy(() =>
  import('./VisitDialog').then((module) => ({ default: module.VisitDialog })),
);

/** How a contact happened, picked by hand (a message is logged from the message buttons). */
const CHANNELS = ['call', 'meeting'] as const satisfies readonly Channel[];
const OUTCOMES = [
  'talked',
  'no_answer',
  'call_later',
  'wrong_number',
] as const satisfies readonly CallOutcome[];

/** How a call with no answer is followed (`supports.no_answer_send`): SMS is the default. */
const NO_ANSWER_SENDS = [
  'sms',
  'whatsapp',
  'telegram',
  'none',
] as const satisfies readonly NoAnswerSend[];

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
  const named = useDisplayName();
  const linphone = useLinphoneDial();
  const { t: tSales } = useTranslation('sales');
  const salesFormat = useSalesFormat();
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
    noAnswerSend = 'sms',
  } = values;
  const template = values.template ?? String(customer.templates[0]?.id ?? '');
  const change =
    <K extends keyof ContactValues>(key: K) =>
    (value: ContactValues[K]) =>
      updateContactDraft(draft.key, { [key]: value });
  const [checked, setChecked] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [visiting, setVisiting] = useState(false);
  const gapsRef = useRef<HTMLDivElement>(null);
  /** A meeting at the office set from this log (S79): the customer page reloads after it. */
  const [booked, setBooked] = useState<string | null>(null);
  /** A live (or just ended) office call: the channel is the phone and the strip names the call. */
  const liveCall = draft.call;

  const message = isMessage(channel);
  const call = channel === 'call';
  /** Logging a booked consultation: the channel is fixed. */
  const session = !!start.reservation;
  const noAnswer = call && outcome === 'no_answer';
  /** The seller picks how a no-answer is followed (an older server always sends the SMS). */
  const sendChoice = noAnswer && !!customer.supports.no_answer_send;
  /** A no-answer followed from the seller's own WhatsApp or Telegram: it opens with a ready text. */
  const appSend =
    sendChoice && (noAnswerSend === 'whatsapp' || noAnswerSend === 'telegram')
      ? noAnswerSend
      : null;
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
  // A meeting at the office ahead is the follow-up (S79): the log keeps it as the next step.
  const meeting = ON_SERVER.visitFollowUp ? (booked ?? meetingAhead(customer)) : null;
  const asksFollowUp = !meeting && !noAnswer && !lost && !(call && outcome === 'wrong_number');
  const followAt = followAtOf(follow, date);
  const followOn = followOnOf(follow, date);
  const chosen = customer.templates.find((item) => String(item.id) === template);

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (log.isPending || voiceBusy) return;
    setChecked(true);
    if ((lost && !lostReason) || (asksFollowUp && !followAt && !followOn)) return;
    // Open the app first: a window opened after the request would be blocked as a popup.
    const app = isMessage(channel) ? channel : appSend;
    if (app) {
      window.open(messageHref(app, customer.phone, chosen?.text), '_blank', 'noreferrer');
      // A Telegram link can't carry the text: it waits on the clipboard to paste.
      if (app === 'telegram' && chosen?.text)
        void navigator.clipboard.writeText(chosen.text).catch(() => {});
    }
    log.mutate(
      {
        channel,
        ...(call ? { outcome } : {}),
        ...(sendChoice ? { no_answer_send: noAnswerSend } : {}),
        ...(talked && lost ? { stage: 'lost' as const } : {}),
        ...(talked && target && stage !== 'keep' && !lost
          ? { stage: target.stage, ...(target.column !== null ? { column: target.column } : {}) }
          : {}),
        ...(lost && lostReason ? { lost_reason: lostReason } : {}),
        notes: notes.trim() || (message ? (chosen?.title ?? '') : ''),
        follow_up_at: asksFollowUp ? followAt : null,
        ...(asksFollowUp && followOn ? { follow_up_on: followOn } : {}),
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
        onError: (error) => toast.error(t(isVisitConflict(error) ? 'visit.lostFirst' : 'error')),
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
        <FollowUpWhen
          legend={t('customer.logDialog.followUp')}
          follow={follow}
          date={date}
          onChange={(next) => updateContactDraft(draft.key, next)}
        />
      )}
      {asksFollowUp && checked && !followAt && !followOn && (
        <p role="alert" className="m-0 -mt-2 text-sm text-danger">
          {t('customer.logDialog.followDate')}
        </p>
      )}
      {meeting && !lost && (
        <Notice tone="info">
          <strong className="block">
            {t('visit.nextStep', { day: f.weekday(meeting), time: f.time(meeting) })}
          </strong>
          {t('visit.nextStepHint')}
        </Notice>
      )}
      {talked && !lost && !meeting && (
        <button
          type="button"
          onClick={() => setVisiting(true)}
          className="-mt-1 inline-flex min-h-11 items-center gap-2 self-start rounded-full px-1 text-sm font-semibold text-primary-text hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          <Icon name="building" size={16} />
          {t('visit.fromCall')}
        </button>
      )}
      {visiting && (
        <Suspense fallback={null}>
          <VisitDialog
            open
            customer={{ id: customer.id, name: named(customer.name) }}
            onClose={() => setVisiting(false)}
            onBooked={setBooked}
          />
        </Suspense>
      )}
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
        <a
          href={callHref(customer.phone, linphone)}
          className={buttonClass('outline', 'self-start')}
        >
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
      {sendChoice && (
        <ChoiceGroup
          legend={t('customer.logDialog.noAnswerSend')}
          look="segmented"
          value={noAnswerSend}
          onChange={change('noAnswerSend')}
          options={NO_ANSWER_SENDS.map((value) => ({
            value,
            label: t(`customer.logDialog.noAnswerSendOption.${value}`),
          }))}
        />
      )}
      {appSend && customer.templates.length > 0 && (
        <ChoiceGroup
          legend={t('customer.logDialog.template')}
          look="tiles"
          value={template}
          onChange={change('template')}
          options={customer.templates.map((item) => ({
            value: String(item.id),
            label: item.title,
            hint: item.text,
          }))}
        />
      )}
      {noAnswer && (
        <Notice tone="info">
          {sendChoice
            ? t(`customer.logDialog.noAnswerSendNote.${noAnswerSend}`)
            : customer.supports.no_answer_sms
              ? t('customer.logDialog.noAnswer')
              : t('customer.logDialog.noAnswerToday')}
        </Notice>
      )}
    </>
  );
  const steps: { key: string; title: string; body: ReactNode }[] = session
    ? [
        {
          key: 'meeting',
          title: t('customer.logDialog.step.meeting'),
          body: (
            <>
              {notesField}
              <ProfileChips ref={gapsRef} customer={customer.id} dark={false} mode="gaps" />
            </>
          ),
        },
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
  if (asksStage || lost || asksFollowUp || meeting)
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
                name={named(customer.name)}
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
                  titleLabel={t('customer.logDialog.title', { name: named(customer.name) })}
                  titleId={titleId}
                  name={named(customer.name)}
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
        name: named(customer.name),
      })}
      subtitle={
        lead &&
        t('customer.logDialog.subtitle', {
          source: salesFormat.source(lead),
          stage: stageName,
        })
      }
      summary={
        session &&
        start.session && (
          <div className="flex flex-col gap-3">
            <SessionSummary session={start.session} />
            <ProfileChips
              customer={customer.id}
              dark={false}
              mode="known"
              onMissing={() => {
                gapsRef.current?.scrollIntoView({ block: 'center' });
                gapsRef.current?.querySelector('button')?.focus();
              }}
            />
          </div>
        )
      }
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
  const now = useNow(60_000);
  const ends = new Date(session.starts_at).getTime() + (session.minutes ?? 0) * 60_000;
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
      {ends <= now && (
        <span className="ms-auto flex-none rounded-full bg-good-tint px-2.5 py-1 text-xs font-semibold text-good">
          {t('customer.logDialog.sessionEnded', { ago: f.timeAgo(new Date(ends)) })}
        </span>
      )}
    </div>
  );
}
