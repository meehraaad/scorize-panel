import { useState, type SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { CallRequestButton } from '@/components/applicant/CallRequest';
import { Button } from '@/components/ui/Button';
import { buttonClass } from '@/components/ui/buttonStyles';
import { ChoiceGroup, TextAreaField } from '@/components/ui/Choices';
import { Notice } from '@/components/ui/Notice';
import { SectionCard } from '@/components/ui/SectionCard';
import { StarRating } from '@/components/ui/StarRating';
import type { ApplicantAccess } from '@/lib/applicant/access';
import {
  FEEDBACK_CLEAR,
  FEEDBACK_NEXT,
  useSendFeedback,
  type Consultation,
  type ConsultationFeedbackAnswer,
} from '@/lib/applicant/consultations';
import { useFormat } from '@/lib/i18n/useFormat';
import { toast } from '@/lib/toast';

const MAX_COMMENT = 1000;

/**
 * After a session, before a contract: three short questions about it (the consultant's rating,
 * whether the path is clear, the next step). The answer goes to the seller as a lead (H62); once
 * sent, the card thanks and offers the one step that fits the answer. Contract signing in the panel
 * isn't built yet, so "ready" means a call. Design: "Scorize New User Dashboard" canvas.
 */
export function AfterSessionCard({
  session,
  access,
}: {
  session: Consultation;
  access: ApplicantAccess;
}) {
  const { t } = useTranslation('journey');
  const f = useFormat();
  const title = session.consultant
    ? t('afterSession.title', { name: session.consultant })
    : t('afterSession.titleNoName');
  const meta = t('afterSession.meta', { title: session.title, date: f.date(session.starts_at) });

  if (session.feedback) {
    const next = session.feedback.next;
    return (
      <SectionCard
        id="journey-after-session"
        title={t('afterSession.thanks')}
        subtitle={t(`afterSession.after.${next}`)}
        end={
          next !== 'contract' && (
            <CallRequestButton
              label={t(next === 'cost' ? 'afterSession.callTurkey' : 'afterSession.call')}
              className={buttonClass('outline', 'max-sm:w-full')}
              phone={access.phone}
              topic={next === 'cost' ? 'turkey' : 'admission'}
              page="home"
              reason="guest"
            />
          )
        }
        variant="panel"
        size="lg"
      />
    );
  }
  return (
    <SectionCard
      id="journey-after-session"
      title={title}
      subtitle={`${meta}. ${t('afterSession.subtitle')}`}
      end={
        <Link to={`/consultations/${String(session.id)}`} className={buttonClass('outline')}>
          {t('afterSession.details')}
        </Link>
      }
    >
      <SurveyForm session={session} />
    </SectionCard>
  );
}

function SurveyForm({ session }: { session: Consultation }) {
  const { t } = useTranslation('journey');
  const f = useFormat();
  const send = useSendFeedback(session.id);
  const [rating, setRating] = useState<number | null>(null);
  const [clear, setClear] = useState<ConsultationFeedbackAnswer['clear'] | null>(null);
  const [next, setNext] = useState<ConsultationFeedbackAnswer['next'] | null>(null);
  const [comment, setComment] = useState('');
  const [missing, setMissing] = useState(false);

  const submit = (event: SubmitEvent) => {
    event.preventDefault();
    if (rating === null || clear === null || next === null) {
      setMissing(true);
      return;
    }
    send.mutate(
      { rating, clear, next, comment: comment.trim() },
      {
        onSuccess: () => toast.success(t('afterSession.sent')),
        onError: () => toast.error(t('afterSession.error')),
      },
    );
  };

  return (
    <form
      noValidate
      onSubmit={submit}
      className="flex flex-col gap-5 px-5 pt-2 pb-5 lg:px-8 lg:pb-7"
    >
      <StarRating
        prompt={t('afterSession.rating')}
        value={rating}
        starLabel={(n) => t('afterSession.star', { n: f.number(n) })}
        onRate={setRating}
      />
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
        look="tiles"
        options={FEEDBACK_NEXT.map((value) => ({
          value,
          label: t(`afterSession.nextOption.${value}.label`),
          hint: t(`afterSession.nextOption.${value}.hint`),
        }))}
        value={next}
        onChange={setNext}
      />
      <TextAreaField
        label={t('afterSession.comment')}
        value={comment}
        maxLength={MAX_COMMENT}
        rows={2}
        onChange={(event) => setComment(event.target.value)}
      />
      {missing && (rating === null || clear === null || next === null) && (
        <Notice tone="error">{t('afterSession.required')}</Notice>
      )}
      <Button type="submit" disabled={send.isPending} className="self-start max-sm:w-full">
        {send.isPending ? t('afterSession.sending') : t('afterSession.submit')}
      </Button>
    </form>
  );
}
