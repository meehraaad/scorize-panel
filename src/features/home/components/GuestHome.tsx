import { useTranslation } from 'react-i18next';
import { CallRequestButton } from '@/components/applicant/CallRequest';
import { buttonClass } from '@/components/ui/buttonStyles';
import { LinkTile } from '@/components/ui/LinkTile';
import { lockButtonOnHero } from '@/components/ui/Lock';
import { PageStack } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import { StepBar } from '@/components/ui/Progress';
import type { ApplicantAccess } from '@/lib/applicant/access';
import { useUser } from '@/lib/auth/session';
import { useFormat } from '@/lib/i18n/useFormat';
import { SITE } from '@/lib/site';
import { ON_SERVER } from '@/lib/applicant/onServer';
import { TurkeyCard } from './TurkeyCard';
import { NewUserHome } from './journey/NewUserHome';

const JOURNEY = ['consult', 'writing', 'documents', 'apply', 'results', 'visa'] as const;
const STARTING = ['registered', 'review', 'start', 'call'] as const;
/** Where a registered contract is: under review (step 2). */
const REVIEW_STEP = 1;

/**
 * Home of an account without an active contract: no contract yet (`guest`), or one in review
 * (`pending`). What working with Scorize looks like. Design: canvas V7 section 2 (AppGuest, AppGuestPending). Without a contract, the
 * admission-chance quiz and its result take the hero's place once the quiz is on the server (the
 * new-user dashboard: "Scorize New User Dashboard" canvas).
 */
export function GuestHome({ access }: { access: ApplicantAccess }) {
  // Without a contract, once the quiz is on the server: the journey toward one.
  if (access.state !== 'pending' && ON_SERVER.estimate) return <NewUserHome access={access} />;
  return <ContractlessHome access={access} />;
}

function ContractlessHome({ access }: { access: ApplicantAccess }) {
  const { t } = useTranslation('home');
  const f = useFormat();
  const user = useUser();
  const pending = access.state === 'pending';
  const { prepayment } = access;
  // The prepayment still to pay or fix: the contract page has it, the home only points there.
  const action = pending && prepayment && prepayment.status !== 'paid' ? prepayment : null;
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
        subtitle={t(pending ? 'guest.pending.subtitle' : 'guest.subtitle')}
      />

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
              {t(
                !pending
                  ? 'guest.hero.text'
                  : action
                    ? 'guest.pending.textAction'
                    : 'guest.pending.text',
              )}
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

      {action && (
        <LinkTile
          to="/contract"
          title={t('guest.pending.action.title')}
          text={t(
            `guest.pending.action.${action.status as Exclude<typeof action.status, 'paid'>}`,
            {
              amount: t('guest.pending.action.toman', { amount: f.number(action.amount) }),
            },
          )}
          footer={t('guest.pending.action.go')}
        />
      )}

      {!pending && ON_SERVER.turkey && <TurkeyCard step={access.turkey} />}
    </PageStack>
  );
}
