import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { CallRequestButton } from '@/components/applicant/CallRequest';
import { EstimateFlow } from '@/components/applicant/estimate/EstimateFlow';
import { buttonClass } from '@/components/ui/buttonStyles';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Icon } from '@/components/ui/Icon';
import { LinkTile, TileGrid } from '@/components/ui/LinkTile';
import { lockButtonOnHero } from '@/components/ui/Lock';
import { PageStack } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import { StepBar } from '@/components/ui/Progress';
import { SectionHeading } from '@/components/ui/SectionCard';
import type { ApplicantAccess, LockableSection } from '@/lib/applicant/access';
import { useUser } from '@/lib/auth/session';
import { useFormat } from '@/lib/i18n/useFormat';
import { SITE } from '@/lib/site';
import { ON_SERVER } from '@/lib/applicant/onServer';

const JOURNEY = ['consult', 'writing', 'documents', 'apply', 'results', 'visa'] as const;
const STARTING = ['registered', 'review', 'start', 'call'] as const;
/** Where a registered contract is: under review (step 2). */
const REVIEW_STEP = 1;
const PREVIEWS: { section: LockableSection; to: string }[] = [
  { section: 'applications', to: '/applications' },
  { section: 'documents', to: '/documents' },
  { section: 'tickets', to: '/tickets' },
  { section: 'contract', to: '/contract' },
];

/**
 * Home of an account without an active contract: no contract yet (`guest`), or one in review
 * (`pending`). What working with Scorize looks like, previews of the locked sections, and what is
 * open now. Design: canvas V7 section 2 (AppGuest, AppGuestPending). Without a contract, the
 * admission-chance quiz and its result take the hero's place once the quiz is on the server (the
 * new-user dashboard: "Scorize New User Dashboard" canvas).
 */
export function GuestHome({ access }: { access: ApplicantAccess }) {
  const { t } = useTranslation('home');
  const f = useFormat();
  const user = useUser();
  const pending = access.state === 'pending';
  const dashboard = !pending && ON_SERVER.estimate;
  const name = user.first_name;

  const title = pending
    ? name
      ? t('guest.pending.title', { name })
      : t('guest.pending.titleNoName')
    : name
      ? t('guest.title', { name })
      : t('guest.titleNoName');

  const contract =
    access.features.length > 0 && access.countries.length > 0
      ? t('guest.pending.contract', {
          features: f.list(access.features.map((key) => t(`feature.${key}`))),
          countries: f.list(access.countries),
        })
      : t('guest.pending.contractShort');

  return (
    <PageStack spacing="wide">
      <PageHeader
        title={title}
        subtitle={t(
          pending ? 'guest.pending.subtitle' : dashboard ? 'guest.estimate.text' : 'guest.subtitle',
        )}
      />

      {dashboard ? (
        <EstimateFlow phone={access.phone} detailsTo="/estimate" />
      ) : (
        <section
          aria-labelledby="guest-hero-title"
          className="flex flex-col gap-5 rounded-[24px] bg-hero px-5 py-[22px] text-on-hero shadow-hero lg:gap-7 lg:rounded-[32px] lg:px-11 lg:py-9"
        >
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div className="flex flex-[1_1_420px] flex-col gap-2">
              <span className="text-[13px] font-semibold text-hero-current">
                {t(pending ? 'guest.pending.kicker' : 'guest.hero.kicker')}
              </span>
              <h2
                id="guest-hero-title"
                className="m-0 font-display text-[22px] leading-snug font-bold lg:text-[30px]"
              >
                {pending ? contract : t('guest.hero.title')}
              </h2>
              <p className="m-0 text-[15px] leading-8 text-on-hero-2">
                {t(pending ? 'guest.pending.text' : 'guest.hero.text')}
              </p>
            </div>
            {!pending && (
              <div className="flex flex-wrap gap-2 max-sm:w-full [&>*]:flex-auto">
                <a href={SITE.consultation} className={buttonClass('outline', lockButtonOnHero)}>
                  {t('guest.consult')}
                </a>
                <CallRequestButton
                  label={t('guest.call')}
                  className={buttonClass('primary')}
                  phone={access.phone}
                  topic="admission"
                  page="home"
                  reason="guest"
                />
              </div>
            )}
          </div>
          {pending ? (
            <StepBar
              label={t('guest.pending.steps')}
              tone="onHero"
              steps={STARTING.map((step) => ({
                key: step,
                label: t(`guest.pending.step.${step}`),
              }))}
              current={REVIEW_STEP}
              className="pt-5 shadow-[inset_0_1px_0_var(--hero-line)] lg:pt-7"
            />
          ) : (
            <StepBar
              label={t('guest.hero.steps')}
              tone="onHero"
              steps={JOURNEY.map((step) => ({
                key: step,
                label: t(`guest.step.${step}.name`),
                hint: t(`guest.step.${step}.hint`),
              }))}
              current={-1}
              className="pt-5 shadow-[inset_0_1px_0_var(--hero-line)] lg:pt-7"
            />
          )}
        </section>
      )}

      {!pending && ON_SERVER.turkey && <TurkeyCard step={access.turkey} />}

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
    </PageStack>
  );
}

/**
 * The free Turkey application: an invitation, or where the request stands once started (canvas V7
 * sections 2 and 3).
 */
function TurkeyCard({ step }: { step: ApplicantAccess['turkey'] }) {
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
