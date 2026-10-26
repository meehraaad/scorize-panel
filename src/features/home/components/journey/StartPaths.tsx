import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { CallRequestButton } from '@/components/applicant/CallRequest';
import { buttonClass } from '@/components/ui/buttonStyles';
import { Card } from '@/components/ui/Card';
import { Icon, type IconName } from '@/components/ui/Icon';
import { SectionHeading } from '@/components/ui/SectionCard';
import type { ApplicantAccess } from '@/lib/applicant/access';
import type { StartOffers } from '@/lib/applicant/journey';
import { ON_SERVER } from '@/lib/applicant/onServer';
import { useFormat } from '@/lib/i18n/useFormat';
import immigrationMobileImage from './images/immigration-mobile.webp';
import turkeyStudyMobileImage from './images/turkey-study-mobile.webp';
import styles from './StartPaths.module.css';

const TURKEY_STEPS = [
  { key: 'upload', icon: 'upload' },
  { key: 'review', icon: 'search' },
  { key: 'sign', icon: 'pen' },
] as const satisfies readonly { key: string; icon: IconName }[];

/**
 * The two ways to begin that start today (the consultation has its own card): Turkey, which starts
 * without paying first (its own flow once on the server, a seller's call until then), and a call
 * about a contract, with what it costs per instalment. Artwork sits behind a responsive fade:
 * space above the text on phones, beside it on Turkey's larger desktop card.
 */
export function StartPaths({ access, offers }: { access: ApplicantAccess; offers: StartOffers }) {
  const { t } = useTranslation('journey');
  const f = useFormat();
  const contract = offers.contract;
  const call = (topic: 'turkey' | 'admission', label: string, className: string) => (
    <CallRequestButton
      label={label}
      className={className}
      phone={access.phone}
      topic={topic}
      page="home"
      reason="guest"
    />
  );
  const primary = buttonClass('primary', 'w-full sm:w-auto', 'lg');
  // The secondary action stays readable on the scene in both themes.
  const contractButton = buttonClass(
    'outline',
    `w-full font-bold text-primary-text! shadow-[inset_0_0_0_1.5px_var(--hero-accent)]! ${
      contract ? '' : 'mt-auto'
    }`,
    'lg',
  );

  return (
    <section aria-labelledby="journey-paths" className="flex flex-col gap-3.5">
      <SectionHeading id="journey-paths" title={t('paths.title')} subtitle={t('paths.subtitle')} />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)] lg:gap-5">
        <Card
          aria-labelledby="journey-path-turkey"
          className={`${styles.scene} ${styles.turkey} flex flex-col shadow-[var(--panel-shadow),var(--path-shadow)]`}
        >
          <picture className={styles.art}>
            <img
              src={turkeyStudyMobileImage}
              alt=""
              width={960}
              height={480}
              loading="lazy"
              decoding="async"
            />
          </picture>
          <div
            className={`${styles.content} flex min-w-0 flex-1 flex-col gap-4 p-5 lg:gap-5 lg:p-8`}
          >
            <span className="inline-flex h-7.5 items-center gap-1.5 self-start rounded-full bg-hero-raised px-3 text-xs font-bold text-good shadow-panel">
              <Icon name="check" size={14} />
              {t('paths.turkey.chip')}
            </span>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-bold text-primary-text">
                {t('paths.turkey.kicker')}
              </span>
              <h3
                id="journey-path-turkey"
                className="m-0 font-display text-[19px] leading-relaxed font-bold lg:text-2xl"
              >
                {t('paths.turkey.title')}
              </h3>
              <p className="m-0 text-sm leading-7 text-text-2 lg:text-[15px]">
                {t('paths.turkey.text')}
              </p>
            </div>
            <ol
              aria-label={t('paths.turkey.steps')}
              className="m-0 grid list-none grid-cols-3 gap-2 rounded-2xl bg-path-sand p-3.5"
            >
              {TURKEY_STEPS.map(({ key, icon }) => (
                <li
                  key={key}
                  className="flex flex-col items-center gap-1.5 text-center text-xs leading-5 font-semibold"
                >
                  <span
                    aria-hidden="true"
                    className={`flex size-10 items-center justify-center rounded-[14px] bg-surface shadow-panel ${
                      key === 'upload'
                        ? 'text-path-sun'
                        : key === 'review'
                          ? 'text-path-sea'
                          : 'text-primary-text'
                    }`}
                  >
                    <Icon name={icon} size={20} />
                  </span>
                  {t(`paths.turkey.step.${key}`)}
                </li>
              ))}
            </ol>
            <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2">
              {ON_SERVER.turkey ? (
                <Link to="/turkey" className={primary}>
                  {t('paths.turkey.start')}
                </Link>
              ) : (
                call('turkey', t('paths.turkey.call'), primary)
              )}
              <span className="text-[13px] text-text-2 max-sm:w-full max-sm:text-center">
                {t('paths.turkey.note')}
              </span>
            </div>
          </div>
        </Card>

        <Card
          aria-labelledby="journey-path-contract"
          className={`${styles.scene} ${styles.contract} flex flex-col`}
        >
          <picture className={styles.art}>
            <img
              src={immigrationMobileImage}
              alt=""
              width={960}
              height={480}
              loading="lazy"
              decoding="async"
            />
          </picture>
          <div className={`${styles.content} flex flex-1 flex-col gap-3.5 p-5 lg:p-6`}>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-bold text-primary-text">
                {t('paths.contract.kicker')}
              </span>
              <h3
                id="journey-path-contract"
                className="m-0 font-display text-lg leading-relaxed font-bold lg:text-xl"
              >
                {t('paths.contract.title')}
              </h3>
              <p className="m-0 text-sm leading-7 text-text-2">{t('paths.contract.text')}</p>
            </div>
            {contract && (
              <>
                <ul className="m-0 flex list-none flex-col gap-2 p-0 text-sm">
                  {[
                    contract.writing && t('paths.contract.writing'),
                    t('paths.contract.applies'),
                    t('paths.contract.instalments', { n: f.number(contract.instalments) }),
                  ]
                    .filter(Boolean)
                    .map((line) => (
                      <li key={line as string} className="flex items-center gap-2">
                        <Icon name="check" size={16} className="flex-none text-good" />
                        {line}
                      </li>
                    ))}
                </ul>
                <p className="m-0 mt-auto flex items-baseline justify-between gap-2 pt-3.5 text-[13px] text-text-2 shadow-[inset_0_1px_0_var(--hair)]">
                  {t('paths.contract.from')}
                  <span className="font-display text-lg font-bold text-text">
                    {t('slots.toman', { amount: f.number(contract.instalment) })}
                  </span>
                </p>
              </>
            )}
            {call('admission', t('paths.contract.start'), contractButton)}
          </div>
        </Card>
      </div>
    </section>
  );
}
