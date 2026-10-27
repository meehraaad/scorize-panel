import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { CallRequestButton } from '@/components/applicant/CallRequest';
import { buttonClass } from '@/components/ui/buttonStyles';
import { SectionCard } from '@/components/ui/SectionCard';
import { sessionHref } from '@/lib/applicant/consultations';
import type { ApplicantAccess } from '@/lib/applicant/access';
import type { Consultation } from '@/lib/applicant/consultations';
import { useFormat } from '@/lib/i18n/useFormat';

/**
 * Back a while after a session, still without a contract: one short card that remembers it (who,
 * when, its notes) and offers a call, shaped by what they said in the survey (cost → Turkey). It
 * takes the place of the readiness checklist, whose steps lead to a session they already had.
 */
export function PastSessionCard({
  session,
  access,
}: {
  session: Consultation;
  access: ApplicantAccess;
}) {
  const { t } = useTranslation('journey');
  const f = useFormat();
  const cost = session.feedback?.next === 'cost';
  const title = session.consultant
    ? t('pastSession.title', { name: session.consultant })
    : t('pastSession.titleNoName');
  const meta = t('afterSession.meta', { title: session.title, date: f.date(session.starts_at) });

  return (
    <SectionCard
      id="journey-past-session"
      title={title}
      subtitle={`${meta}. ${t(cost ? 'pastSession.textCost' : 'pastSession.text')}`}
      end={
        <span className="flex flex-wrap gap-2 max-sm:w-full [&>*]:flex-auto">
          <Link to={sessionHref(session.id)} className={buttonClass('outline')}>
            {t('afterSession.details')}
          </Link>
          <CallRequestButton
            label={t(cost ? 'afterSession.callTurkey' : 'afterSession.call')}
            className={buttonClass('primary')}
            phone={access.phone}
            topic={cost ? 'turkey' : 'admission'}
            page="home"
            reason="guest"
          />
        </span>
      }
      variant="panel"
      size="lg"
    />
  );
}
