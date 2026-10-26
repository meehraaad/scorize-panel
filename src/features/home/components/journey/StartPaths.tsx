import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { CallRequestButton } from '@/components/applicant/CallRequest';
import { buttonClass } from '@/components/ui/buttonStyles';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { SectionHeading } from '@/components/ui/SectionCard';
import type { ApplicantAccess } from '@/lib/applicant/access';
import { ON_SERVER } from '@/lib/applicant/onServer';
import { SITE } from '@/lib/site';

const PATH = 'flex flex-col gap-3 p-5 lg:p-6';

/**
 * The ways to begin, each one step away from money: Turkey (starts without paying first; its own
 * flow once on the server, a seller's call until then), a paid consultation (not once one was
 * booked), or a call about a contract. Design: "Scorize New User Dashboard" canvas, start paths.
 */
export function StartPaths({
  access,
  consulted = false,
}: {
  access: ApplicantAccess;
  /** Has had or booked a session: no consultation offer, two ways left. */
  consulted?: boolean;
}) {
  const { t } = useTranslation('journey');
  const button = buttonClass('primary', 'mt-auto w-full');
  const call = (topic: 'turkey' | 'admission', label: string) => (
    <CallRequestButton
      label={label}
      className={button}
      phone={access.phone}
      topic={topic}
      page="home"
      reason="guest"
    />
  );

  return (
    <section aria-labelledby="journey-paths" className="flex flex-col gap-3.5">
      <SectionHeading id="journey-paths" title={t('paths.title')} subtitle={t('paths.subtitle')} />
      <div className={`grid gap-3 ${consulted ? 'md:grid-cols-2' : 'md:grid-cols-3'}`}>
        <Card
          aria-labelledby="journey-path-turkey"
          className={`${PATH} shadow-[0_0_0_1.5px_var(--primary),var(--panel-shadow)]`}
        >
          <Chip tone="good" small>
            {t('paths.turkey.chip')}
          </Chip>
          <h3 id="journey-path-turkey" className="m-0 text-base font-bold">
            {t('paths.turkey.title')}
          </h3>
          <p className="m-0 text-[13px] leading-6 text-text-2">{t('paths.turkey.text')}</p>
          {ON_SERVER.turkey ? (
            <Link to="/turkey" className={button}>
              {t('paths.turkey.start')}
            </Link>
          ) : (
            call('turkey', t('paths.turkey.call'))
          )}
        </Card>
        {!consulted && (
          <Card aria-labelledby="journey-path-consult" className={PATH}>
            <h3 id="journey-path-consult" className="m-0 text-base font-bold">
              {t('paths.consult.title')}
            </h3>
            <p className="m-0 text-[13px] leading-6 text-text-2">{t('paths.consult.text')}</p>
            <a href={SITE.consultation} className={buttonClass('outline', 'mt-auto w-full')}>
              {t('paths.consult.start')}
            </a>
          </Card>
        )}
        <Card aria-labelledby="journey-path-contract" className={PATH}>
          <h3 id="journey-path-contract" className="m-0 text-base font-bold">
            {t('paths.contract.title')}
          </h3>
          <p className="m-0 text-[13px] leading-6 text-text-2">{t('paths.contract.text')}</p>
          {call('admission', t('paths.contract.start'))}
        </Card>
      </div>
    </section>
  );
}
