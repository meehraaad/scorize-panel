import { useTranslation } from 'react-i18next';
import { CallRequestButton } from '@/components/applicant/CallRequest';
import { Avatar } from '@/components/ui/Avatar';
import { buttonClass } from '@/components/ui/buttonStyles';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { SectionHeading } from '@/components/ui/SectionCard';
import type { ApplicantAccess } from '@/lib/applicant/access';
import type { EstimateResult } from '@/lib/applicant/estimate';
import type { StartOffers } from '@/lib/applicant/journey';
import { useFormat } from '@/lib/i18n/useFormat';
import { SITE } from '@/lib/site';

/** Admissions shown at most. */
const MAX_SIMILAR = 4;

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

/**
 * Recent admissions of people with a background like theirs (same degree, field group and a GPA
 * within one), from the last admission-chance result: no names. None: not shown.
 */
export function SimilarCard({ estimate }: { estimate: EstimateResult }) {
  const { t } = useTranslation('journey');
  const f = useFormat();
  const admissions = estimate.countries
    .flatMap((country) =>
      country.similar.map((admission) => ({ ...admission, country: country.country.name })),
    )
    .sort((a, b) => b.year - a.year)
    .slice(0, MAX_SIMILAR);
  if (admissions.length === 0) return null;

  return (
    <section aria-labelledby="journey-similar" className="flex flex-col gap-3.5">
      <SectionHeading
        id="journey-similar"
        title={t('similar.title')}
        subtitle={t('similar.subtitle')}
        end={
          <a
            href={SITE.admissionSamples}
            className="inline-flex min-h-11 items-center text-sm font-semibold text-primary-text"
          >
            {t('similar.all')}
          </a>
        }
      />
      <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 xl:grid-cols-4">
        {admissions.map((admission, index) => (
          <li
            key={index}
            className="flex flex-col gap-1.5 rounded-[20px] bg-surface p-4 shadow-panel"
          >
            <span className="flex flex-wrap items-center justify-between gap-2">
              <Chip tone="good" small>
                {t('similar.admitted')}
              </Chip>
              <span className="text-[13px] text-text-2">{f.digits(String(admission.year))}</span>
            </span>
            <span className="text-[15px] font-bold" dir="auto">
              {admission.university}
            </span>
            <span className="text-[13px] text-text-2">
              {[admission.field, admission.country].filter(Boolean).join(' · ')}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
