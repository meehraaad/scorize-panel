import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { buttonClass } from '@/components/ui/buttonStyles';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Icon } from '@/components/ui/Icon';
import { LinkTile, TileGrid } from '@/components/ui/LinkTile';
import { SectionHeading } from '@/components/ui/SectionCard';
import type { ApplicantAccess, LockableSection } from '@/lib/applicant/access';
import { ON_SERVER } from '@/lib/applicant/onServer';
import { SITE } from '@/lib/site';

const PREVIEWS: { section: LockableSection; to: string }[] = [
  { section: 'applications', to: '/applications' },
  { section: 'documents', to: '/documents' },
  { section: 'tickets', to: '/tickets' },
  { section: 'contract', to: '/contract' },
];

/** Previews of the locked sections, and what is open without a contract. */
export function GuestSections({ pending }: { pending: boolean }) {
  const { t } = useTranslation('home');
  return (
    <>
      <section aria-labelledby="guest-previews" className="flex flex-col gap-3.5">
        <SectionHeading
          id="guest-previews"
          title={t(pending ? 'guest.pending.previews' : 'guest.previews.title')}
          subtitle={t(pending ? 'guest.pending.previewsSubtitle' : 'guest.previews.subtitle')}
        />
        <TileGrid>
          {PREVIEWS.map(({ section, to }) => (
            <LinkTile
              key={section}
              to={to}
              title={t(`guest.preview.${section}.title`)}
              text={t(`guest.preview.${section}.text`)}
              footer={t('guest.previews.see')}
              end={
                <span
                  className="flex size-8 flex-none items-center justify-center rounded-full bg-canvas text-text-2"
                  title={t('guest.previews.locked')}
                >
                  <Icon name="lock" size={14} />
                  <span className="sr-only">{t('guest.previews.locked')}</span>
                </span>
              }
            />
          ))}
        </TileGrid>
      </section>

      <section aria-labelledby="guest-open" className="flex flex-col gap-3.5">
        <SectionHeading
          id="guest-open"
          title={t('guest.open.title')}
          subtitle={t('guest.open.subtitle')}
        />
        <TileGrid>
          <LinkTile
            href={SITE.consultation}
            title={t('guest.open.consult.title')}
            text={t('guest.open.consult.text')}
          />
          <LinkTile
            to="/services"
            title={t('guest.open.services.title')}
            text={t('guest.open.services.text')}
          />
          {ON_SERVER.estimate ? (
            <LinkTile
              to="/estimate"
              title={t('guest.open.estimate.title')}
              text={t('guest.open.estimate.text')}
            />
          ) : (
            <LinkTile
              href={SITE.estimateAdmission}
              title={t('guest.open.estimate.title')}
              text={t('guest.open.estimate.text')}
            />
          )}
          <LinkTile
            href={SITE.admissionSamples}
            title={t('guest.open.samples.title')}
            text={t('guest.open.samples.text')}
          />
        </TileGrid>
      </section>
    </>
  );
}

/**
 * The free Turkey application: an invitation, or where the request stands once started (canvas V7
 * sections 2 and 3).
 */
export function TurkeyCard({ step }: { step: ApplicantAccess['turkey'] }) {
  const { t } = useTranslation('home');
  return (
    <Card
      aria-labelledby="guest-turkey"
      className="flex flex-wrap items-center gap-x-7 gap-y-5 p-5 shadow-[0_0_0_1.5px_var(--primary),var(--panel-shadow)] lg:p-7"
    >
      <span
        aria-hidden="true"
        className="flex size-16 flex-none items-center justify-center rounded-[20px] bg-tint text-[15px] font-extrabold tracking-wider text-primary-text"
      >
        {t('guest.turkey.badge')}
      </span>
      <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-1.5">
        <span className="flex flex-wrap items-center gap-2">
          <h2 id="guest-turkey" className="m-0 font-display text-[21px] font-bold">
            {t('guest.turkey.title')}
          </h2>
          <Chip tone="good">{t('guest.turkey.free')}</Chip>
        </span>
        <p className="m-0 text-sm leading-7 text-text-2">
          {step ? t(`guest.turkey.state.${step}`) : t('guest.turkey.text')}
        </p>
      </div>
      <Link to="/turkey" className={buttonClass('primary', 'max-sm:w-full')}>
        {t(step ? 'guest.turkey.continue' : 'guest.turkey.start')}
      </Link>
    </Card>
  );
}
