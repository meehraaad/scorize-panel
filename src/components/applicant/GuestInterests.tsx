import { useSuspenseQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { InterestsCard } from '@/components/applicant/InterestsCard';
import { Icon } from '@/components/ui/Icon';
import { guestInterestsQuery, useSaveGuestInterests } from '@/lib/applicant/interests';
import { useFormat } from '@/lib/i18n/useFormat';

/**
 * Research interests before a contract, kept on the account (the case starts with them), and what
 * they already find: how many professors in Scorize's list work on them, a few without names. The
 * bot writes to them once the case starts. On the applications and contract tabs without a contract.
 * Design: canvas "تب اپلای‌ها و نتایج", بدون قرارداد.
 */
export function GuestInterests({ id }: { id: string }) {
  const { t } = useTranslation('applications');
  const f = useFormat();
  const { data } = useSuspenseQuery(guestInterestsQuery);
  const save = useSaveGuestInterests();

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:gap-5">
      <InterestsCard
        id={id}
        interests={data.interests}
        save={save}
        title={t('interests.title')}
        subtitle={t('interests.subtitle')}
      />
      <section
        aria-labelledby={`${id}-professors`}
        className="flex flex-col gap-3.5 rounded-[24px] p-6 text-on-hero shadow-luxe bg-luxe-soft lg:rounded-[32px] lg:p-8"
      >
        <h2 id={`${id}-professors`} className="m-0 text-[13px] font-bold text-luxe-gold-light">
          {t('interests.professors')}
        </h2>
        {data.interests.length > 0 ? (
          <>
            <p className="m-0 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
              <span className="font-display text-[34px] leading-tight font-bold text-luxe-gold-light lg:text-[40px]">
                {f.number(data.professors)}
              </span>
              <span className="text-[15px] text-on-luxe-2">
                {t('interests.universities', { n: f.number(data.universities) })}
              </span>
            </p>
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {data.sample.map((row, index) => (
                <li
                  key={`${row.interest}-${String(index)}`}
                  className="flex items-center justify-between gap-3 rounded-[14px] bg-hero-raised px-4 py-2.5"
                >
                  <span className="text-[13px] text-on-luxe-2">
                    {row.country} · <bdi>{row.interest}</bdi>
                  </span>
                  <Icon name="lock" size={14} className="flex-none text-luxe-gold-light" />
                </li>
              ))}
            </ul>
            <p className="m-0 text-[13px] leading-6 text-on-luxe-2">{t('interests.bot')}</p>
          </>
        ) : (
          <p className="m-0 text-[15px] leading-7 text-on-luxe-2">{t('interests.empty')}</p>
        )}
      </section>
    </div>
  );
}
