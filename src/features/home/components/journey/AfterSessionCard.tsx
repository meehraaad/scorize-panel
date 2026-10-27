import { useSuspenseInfiniteQuery } from '@tanstack/react-query';
import { useState, type SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { CallRequestButton } from '@/components/applicant/CallRequest';
import { Button } from '@/components/ui/Button';
import { buttonClass } from '@/components/ui/buttonStyles';
import { Card } from '@/components/ui/Card';
import { ChoiceGroup } from '@/components/ui/Choices';
import { Notice } from '@/components/ui/Notice';
import { StarRating } from '@/components/ui/StarRating';
import { sessionHref } from '@/lib/applicant/consultations';
import type { ApplicantAccess } from '@/lib/applicant/access';
import {
  FEEDBACK_CLEAR,
  FEEDBACK_NEXT,
  sessionSummariesQuery,
  useSendFeedback,
  type Consultation,
  type ConsultationFeedbackAnswer,
} from '@/lib/applicant/consultations';
import { useFormat } from '@/lib/i18n/useFormat';
import { toast } from '@/lib/toast';

/**
 * After a session, before a contract: what the consultant wrote about it, the next step (a call
 * about the contract; signing in the panel isn't built yet) and a short survey about it, stars
 * first. The survey's answer goes to the seller as a lead (H62) and shapes the next step (cost →
 * Turkey). Design: "مشاوره در صفحه اصلی پنل" canvas, after the session.
 */
export function AfterSessionCard({
  session,
  access,
}: {
  session: Consultation;
  access: ApplicantAccess;
}) {
  return (
    <div className="flex flex-col gap-4 lg:gap-5">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:gap-5">
        <SummaryCard session={session} />
        <NextStepCard session={session} access={access} />
      </div>
      {!session.feedback && <SurveyCard session={session} />}
    </div>
  );
}

/** The consultant's note on the session (the shared session advice), else the session's topic. */
function SummaryCard({ session }: { session: Consultation }) {
  const { t } = useTranslation('journey');
  const f = useFormat();
  const { data } = useSuspenseInfiniteQuery(sessionSummariesQuery());
  const note = data.pages
    .flatMap((page) => page.results)
    .find((row) => row.reservation === session.id)?.customer_summary;
  const text = note ?? session.summary;

  return (
    <Card aria-labelledby="journey-summary" className="flex flex-col gap-3 p-5 lg:gap-4 lg:p-9">
      <div className="flex items-center gap-3">
        {session.consultant && (
          <span
            aria-hidden="true"
            className="flex size-11 flex-none items-center justify-center rounded-full bg-tint font-display text-lg font-bold text-primary-text"
          >
            {session.consultant.slice(0, 1)}
          </span>
        )}
        <span className="flex min-w-0 flex-col">
          {session.consultant && (
            <span className="text-[15px] font-bold">{session.consultant}</span>
          )}
          <span className="text-[13px] text-text-2">
            {t('afterSession.meta', { title: session.title, date: f.weekday(session.starts_at) })}
          </span>
        </span>
      </div>
      <h2
        id="journey-summary"
        className="m-0 font-display text-lg leading-[1.7] font-semibold lg:text-2xl"
      >
        {t('afterSession.summary')}
      </h2>
      <p
        className={`m-0 text-sm leading-8 break-words whitespace-pre-wrap lg:text-[15px] ${text ? '' : 'text-text-2'}`}
      >
        {text ?? t('afterSession.noSummary')}
      </p>
      <div className="mt-auto flex justify-end shadow-[inset_0_1px_0_var(--hair)]">
        <Link
          to={sessionHref(session.id)}
          className="inline-flex min-h-11 items-center pt-1 text-sm font-bold text-primary-text"
        >
          {t('afterSession.details')}
        </Link>
      </div>
    </Card>
  );
}

/** The next step on the luxe card: a call about the contract, or about Turkey when cost is the worry. */
function NextStepCard({ session, access }: { session: Consultation; access: ApplicantAccess }) {
  const { t } = useTranslation('journey');
  const next = session.feedback?.next;
  const cost = next === 'cost';
  return (
    <section
      aria-labelledby="journey-next"
      className="flex flex-col gap-2.5 rounded-[24px] p-5 text-on-hero shadow-luxe bg-luxe lg:rounded-[26px] lg:p-9"
    >
      <span className="text-xs font-semibold text-luxe-gold-light lg:text-[13px]">
        {t('afterSession.nextKicker')}
      </span>
      <h2
        id="journey-next"
        className="m-0 font-display text-xl leading-[1.7] font-semibold lg:text-2xl"
      >
        {t('afterSession.nextTitle')}
      </h2>
      <p className="m-0 text-[13px] leading-7 text-on-luxe-2 lg:text-sm">
        {next ? t(`afterSession.after.${next}`) : t('afterSession.nextText')}
      </p>
      <CallRequestButton
        label={t(cost ? 'afterSession.callTurkey' : 'afterSession.callContract')}
        className={buttonClass('gold', 'mt-auto w-full', 'lg', 'rounded')}
        phone={access.phone}
        topic={cost ? 'turkey' : 'admission'}
        page="home"
        reason="guest"
      />
    </section>
  );
}

/** Stars first; the two other questions open once they are given. */
function SurveyCard({ session }: { session: Consultation }) {
  const { t } = useTranslation('journey');
  const f = useFormat();
  const send = useSendFeedback(session.id);
  const [rating, setRating] = useState<number | null>(null);
  const [clear, setClear] = useState<ConsultationFeedbackAnswer['clear'] | null>(null);
  const [next, setNext] = useState<ConsultationFeedbackAnswer['next'] | null>(null);
  const [missing, setMissing] = useState(false);
  const title = session.consultant
    ? t('afterSession.title', { name: session.consultant })
    : t('afterSession.titleNoName');

  const submit = (event: SubmitEvent) => {
    event.preventDefault();
    if (rating === null || clear === null || next === null) {
      setMissing(true);
      return;
    }
    send.mutate(
      { rating, clear, next, comment: '' },
      {
        onSuccess: () => toast.success(t('afterSession.sent')),
        onError: () => toast.error(t('afterSession.error')),
      },
    );
  };

  return (
    <Card aria-labelledby="journey-survey" className="flex flex-col gap-4 p-5 lg:px-9 lg:py-6">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1">
        <div className="flex flex-col gap-0.5">
          <h2 id="journey-survey" className="m-0 text-base font-bold lg:text-[17px]">
            {title}
          </h2>
          <p className="m-0 text-[13px] text-text-2">{t('afterSession.subtitle')}</p>
        </div>
        <StarRating
          prompt=""
          value={rating}
          starLabel={(n) => t('afterSession.star', { n: f.number(n) })}
          onRate={setRating}
        />
      </div>
      {rating !== null && (
        <form
          noValidate
          onSubmit={submit}
          className="flex flex-col gap-5 pt-4 shadow-[inset_0_1px_0_var(--hair)] lg:flex-row lg:gap-7"
        >
          <ChoiceGroup
            legend={t('afterSession.clear')}
            options={FEEDBACK_CLEAR.map((value) => ({
              value,
              label: t(`afterSession.clearOption.${value}`),
            }))}
            value={clear}
            onChange={setClear}
          />
          <ChoiceGroup
            legend={t('afterSession.next')}
            options={FEEDBACK_NEXT.map((value) => ({
              value,
              label: t(`afterSession.nextOption.${value}.label`),
            }))}
            value={next}
            onChange={setNext}
          />
          <Button type="submit" disabled={send.isPending} className="flex-none">
            {send.isPending ? t('afterSession.sending') : t('afterSession.submit')}
          </Button>
        </form>
      )}
      {missing && (clear === null || next === null) && (
        <Notice tone="error">{t('afterSession.required')}</Notice>
      )}
    </Card>
  );
}
