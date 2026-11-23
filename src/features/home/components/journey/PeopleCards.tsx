import { useTranslation } from 'react-i18next';
import { CallRequestButton } from '@/components/applicant/CallRequest';
import { Avatar } from '@/components/ui/Avatar';
import { buttonClass } from '@/components/ui/buttonStyles';
import { Card } from '@/components/ui/Card';
import type { ApplicantAccess } from '@/lib/applicant/access';
import type { StartOffers } from '@/lib/applicant/journey';

/**
 * The person's own seller: a name to talk to instead of a queue. "Call me" reaches that seller (the
 * open lead is theirs). Design: "Scorize New User Dashboard v2" canvas, Main (personal consultant).
 */
export function ConsultantCard({
  consultant,
  access,
}: {
  consultant: NonNullable<StartOffers['consultant']>;
  access: ApplicantAccess;
}) {
  const { t } = useTranslation('journey');
  return (
    <Card
      aria-labelledby="journey-consultant"
      className="flex flex-wrap items-center gap-x-5 gap-y-4 p-5 lg:p-6"
    >
      <Avatar name={consultant.name} />
      <div className="flex min-w-0 flex-[1_1_240px] flex-col gap-0.5">
        <span className="text-[13px] font-semibold text-primary-text">
          {t('consultant.kicker')}
        </span>
        <h2 id="journey-consultant" className="m-0 text-lg font-bold">
          {consultant.name}
        </h2>
        <p className="m-0 text-[13px] leading-6 text-text-2">{t('consultant.text')}</p>
      </div>
      <CallRequestButton
        label={t('consultant.call')}
        className={buttonClass('primary', 'max-sm:w-full')}
        phone={access.phone}
        topic="admission"
        page="home"
        reason="guest"
      />
    </Card>
  );
}
