import { useSuspenseQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { latestEstimateQuery } from '@/lib/applicant/estimate';
import { useFormat } from '@/lib/i18n/useFormat';
import { SITE } from '@/lib/site';

/** Admissions shown: the closest one large, the rest as a list. */
const MAX = 4;

/**
 * Recent admissions of people with a background like theirs (from the last admission-chance
 * result, no names): the most recent one leads, the others as a divided list beside it, then the
 * site's admission samples. No result or none similar: not shown.
 * Design: canvas "Scorize New User Dashboard v2", ContractGuest.
 */
export function Admissions() {
  const { t } = useTranslation('contract');
  const f = useFormat();
  const { data: estimate } = useSuspenseQuery(latestEstimateQuery);
  const admissions = (estimate?.countries ?? [])
    .flatMap((country) =>
      country.similar.map((admission) => ({ ...admission, country: country.country.name })),
    )
    .sort((a, b) => b.year - a.year)
    .slice(0, MAX);
  const [lead, ...rest] = admissions;
  if (!lead) return null;
  const line = (field: string | null, year: number) =>
    [field, f.digits(String(year))].filter(Boolean).join(' · ');

  return (
    <Card aria-labelledby="contract-admissions" className="grid lg:grid-cols-2">
      <div className="flex flex-col gap-2 bg-canvas/60 p-6 lg:border-e lg:border-[var(--hair)] lg:p-8">
        <h2 id="contract-admissions" className="m-0 mb-4 text-[15px] font-bold text-text-2">
          {t('guest.admissions.title')}
        </h2>
        <span className="text-sm font-bold text-primary-text">{lead.country}</span>
        <span className="font-display text-[26px] leading-snug font-bold lg:text-[30px]" dir="auto">
          {lead.university}
        </span>
        <span className="text-text-2">{line(lead.field, lead.year)}</span>
        <span className="mt-auto pt-5 text-[13px] text-text-2">{t('guest.admissions.note')}</span>
      </div>
      <div className="flex flex-col px-6 pt-2 pb-4 lg:px-8">
        {rest.length > 0 && (
          <ul className="m-0 list-none p-0">
            {rest.map((admission, index) => (
              <li
                key={index}
                className="grid grid-cols-[76px_minmax(0,1fr)] gap-x-4 gap-y-0.5 py-4 shadow-[inset_0_-1px_0_var(--hair)]"
              >
                <span className="row-span-2 pt-0.5 text-[13px] font-bold">{admission.country}</span>
                <span className="text-base font-bold" dir="auto">
                  {admission.university}
                </span>
                <span className="text-[13px] text-text-2">
                  {line(admission.field, admission.year)}
                </span>
              </li>
            ))}
          </ul>
        )}
        <a
          href={SITE.admissionSamples}
          className="mt-auto inline-flex min-h-11 items-center pt-3 text-[15px] font-semibold text-primary-text"
        >
          {t('guest.admissions.all')}
        </a>
      </div>
    </Card>
  );
}
