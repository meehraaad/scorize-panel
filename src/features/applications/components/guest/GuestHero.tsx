import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { CallRequestButton } from '@/components/applicant/CallRequest';
import { buttonClass } from '@/components/ui/buttonStyles';
import { Chip } from '@/components/ui/Chip';
import { Icon } from '@/components/ui/Icon';
import type { ApplicantAccess } from '@/lib/applicant/access';

/** The cards behind the front one: a result and a sent application, fanned out. */
const BEHIND = [
  { result: 'accepted', tone: 'good', turn: 'translate(-24px, -16px) rotate(-6deg)' },
  { result: 'submitted', tone: 'info', turn: 'translate(20px, -2px) rotate(4deg)' },
] as const;

/**
 * The tab's promise without a contract, on the luxe card: they approve every university, the team
 * sends and follows up. Beside it a fanned deck of application cards (shapes only, no sample
 * universities), the front one waiting for their approval. Design: canvas "تب اپلای‌ها و نتایج",
 * بدون قرارداد.
 */
export function GuestHero({ access }: { access: ApplicantAccess }) {
  const { t } = useTranslation('applications');
  return (
    <section
      aria-labelledby="apps-guest"
      className="grid items-center gap-8 overflow-hidden rounded-[24px] bg-luxe p-6 text-on-hero shadow-luxe lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:rounded-[32px] lg:p-9"
    >
      <div className="flex flex-col gap-3.5">
        <span className="inline-flex h-8 items-center gap-2 self-start rounded-full bg-luxe-gold px-4 text-sm font-bold">
          <Icon name="lock" size={14} />
          {t('guest.chip')}
        </span>
        <h2
          id="apps-guest"
          className="m-0 font-display text-[26px] leading-snug font-bold lg:text-[32px]"
        >
          {t('guest.title')}
        </h2>
        <p className="m-0 text-[15px] leading-7 text-on-luxe-2">{t('guest.text')}</p>
        <div className="flex flex-wrap gap-2.5 pt-4">
          <Link to="/consultations/book" className={buttonClass('gold', 'flex-[1_1_180px]', 'lg')}>
            {t('guest.book')}
          </Link>
          <CallRequestButton
            label={t('guest.call')}
            className={buttonClass('onLuxe', 'flex-[1_1_150px]', 'lg')}
            phone={access.phone}
            topic="admission"
            page="applications"
            reason="guest"
          />
        </div>
        <span className="text-[13px] text-on-luxe-2">{t('guest.price')}</span>
      </div>

      <div aria-hidden="true" className="relative max-lg:hidden" style={{ height: 300 }}>
        {BEHIND.map(({ result, tone, turn }, index) => (
          <div
            key={result}
            className="absolute flex flex-col gap-3 rounded-[20px] bg-surface p-5 text-text shadow-luxe"
            style={{ top: 24 + index * 18, insetInline: 32, transform: turn }}
          >
            <span className="self-start">
              <Chip tone={tone} small dot>
                {t(`result.${result}`)}
              </Chip>
            </span>
            <span className="h-3.5 w-3/5 rounded-full bg-track" />
            <span className="h-3 w-2/5 rounded-full bg-track" />
          </div>
        ))}
        <div
          className="absolute inset-x-4 flex flex-col gap-3 rounded-[20px] bg-surface p-5 text-text shadow-[var(--panel-shadow),inset_0_0_0_1.5px_var(--hero-accent)]"
          style={{ top: 84 }}
        >
          <span className="self-start rounded-full bg-tint px-2.5 py-0.5 text-xs font-semibold text-primary-text">
            {t('awaiting.suggested')}
          </span>
          <span className="h-4 w-1/2 rounded-full bg-track" />
          <span className="h-3 w-1/3 rounded-full bg-track" />
          <span className="flex gap-2">
            <span className="flex h-11 flex-[2] items-center justify-center rounded-full bg-primary text-sm font-bold text-on-primary">
              {t('approval.approve')}
            </span>
            <span className="flex h-11 flex-1 items-center justify-center rounded-full text-sm text-text-2 shadow-[inset_0_0_0_1px_var(--line-2)]">
              {t('approval.reject')}
            </span>
          </span>
        </div>
      </div>
    </section>
  );
}
