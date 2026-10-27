import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { CallRequestButton } from '@/components/applicant/CallRequest';
import { buttonClass } from '@/components/ui/buttonStyles';
import type { ApplicantAccess } from '@/lib/applicant/access';
import { ON_SERVER } from '@/lib/applicant/onServer';

/**
 * The two ways to start, without a contract: Turkey first and loudest (no prepayment, the easiest
 * yes; its own flow once on the server, a seller's call until then), and the full contract (from
 * its starting price, a consultation or a call). One line each, the price, one main action.
 * Design: canvas "Scorize New User Dashboard v2", ContractGuest.
 */
export function StartCards({ access }: { access: ApplicantAccess }) {
  const { t } = useTranslation('contract');
  const gold = (className: string) => buttonClass('gold', className, 'lg');
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:gap-5">
      <section
        aria-labelledby="contract-turkey"
        className="flex flex-col gap-3.5 rounded-[24px] p-6 text-on-hero shadow-luxe bg-forest lg:rounded-[32px] lg:p-9"
      >
        <span className="inline-flex h-8 items-center self-start rounded-full px-4 text-sm font-bold bg-luxe-gold">
          {t('guest.turkey.chip')}
        </span>
        <h2
          id="contract-turkey"
          className="m-0 font-display text-[30px] leading-snug font-bold lg:text-[44px]"
        >
          {t('guest.turkey.title')}
        </h2>
        <p className="m-0 text-base leading-7 text-on-forest-2 lg:text-[17px]">
          {t('guest.turkey.text')}
        </p>
        <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 pt-4">
          {ON_SERVER.turkey ? (
            <Link to="/turkey" className={gold('max-sm:w-full')}>
              {t('guest.turkey.start')}
            </Link>
          ) : (
            <CallRequestButton
              label={t('guest.turkey.call')}
              className={gold('max-sm:w-full')}
              phone={access.phone}
              topic="turkey"
              page="contract"
              reason="guest"
            />
          )}
          <span className="text-[13px] text-on-forest-2">{t('guest.turkey.note')}</span>
        </div>
      </section>

      <section
        aria-labelledby="contract-full"
        className="flex flex-col gap-3.5 rounded-[24px] p-6 text-on-hero shadow-luxe bg-luxe-soft lg:rounded-[32px] lg:p-8"
      >
        <span className="text-[13px] font-semibold text-on-luxe-2">
          {t('guest.full.countries')}
        </span>
        <h2
          id="contract-full"
          className="m-0 font-display text-[26px] leading-snug font-bold lg:text-[32px]"
        >
          {t('guest.full.title')}
        </h2>
        <p className="m-0 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
          <span className="text-[15px] text-on-luxe-2">{t('guest.full.from')}</span>
          <span className="font-display text-[34px] leading-tight font-bold text-luxe-gold-light lg:text-[40px]">
            {t('guest.full.price')}
          </span>
          <span className="text-[15px] text-on-luxe-2">{t('guest.full.instalments')}</span>
        </p>
        <p className="m-0 text-[15px] leading-7 text-on-luxe-2">{t('guest.full.text')}</p>
        <div className="mt-auto flex flex-wrap gap-2.5 pt-4">
          <Link to="/consultations/book" className={gold('flex-[1_1_180px]')}>
            {t('guest.full.book')}
          </Link>
          <CallRequestButton
            label={t('guest.full.call')}
            className={buttonClass('onLuxe', 'flex-[1_1_150px]', 'lg')}
            phone={access.phone}
            topic="admission"
            page="contract"
            reason="guest"
          />
        </div>
      </section>
    </div>
  );
}
