import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/ui/Icon';
import { useFormat } from '@/lib/i18n/useFormat';
import { SITE } from '@/lib/site';
import type { AdmissionSample } from '../../offers';

/**
 * "Admissions won with these same documents": Scorize's newest admission samples (university,
 * degree and field, the scores they had), and a link to all of them on the main site.
 */
export function Samples({ samples }: { samples: AdmissionSample[] }) {
  const { t } = useTranslation('documents');
  const f = useFormat();
  if (samples.length === 0) return null;

  return (
    <section aria-labelledby="docs-samples" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div className="flex flex-col gap-0.5">
          <h2 id="docs-samples" className="m-0 font-display text-[22px] font-black lg:text-2xl">
            {t('newUser.samples.title')}
          </h2>
          <p className="m-0 text-sm leading-7 text-text-2">{t('newUser.samples.subtitle')}</p>
        </div>
        <a
          href={SITE.admissionSamples}
          className="flex min-h-11 items-center gap-1.5 text-sm font-bold text-primary-text"
        >
          {t('newUser.samples.all')}
          <Icon name="chevronEnd" size={16} />
        </a>
      </div>
      <ul className="m-0 grid list-none grid-cols-1 gap-3.5 p-0 md:grid-cols-3">
        {samples.map((sample) => {
          const facts = [
            sample.ielts !== null && t('newUser.samples.ielts', { score: f.number(sample.ielts) }),
            sample.toefl !== null && t('newUser.samples.toefl', { score: f.number(sample.toefl) }),
            sample.gpa !== null && t('newUser.samples.gpa', { gpa: f.number(sample.gpa) }),
            sample.date && f.monthYear(sample.date),
          ].filter((fact): fact is string => Boolean(fact));
          const program = [
            sample.degree && t(`newUser.samples.degree.${sample.degree}`),
            sample.field,
          ].filter(Boolean);
          return (
            <li
              key={sample.id}
              className="flex flex-col gap-3 rounded-[24px] bg-surface p-5 shadow-panel"
            >
              <div className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="flex size-11 flex-none items-center justify-center rounded-[14px] bg-hero text-on-hero"
                >
                  <Icon name="graduation" size={22} />
                </span>
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-[15px] font-bold" dir="auto">
                    {sample.university}
                  </span>
                  {program.length > 0 && (
                    <span className="truncate text-[13px] text-text-2">{program.join(' · ')}</span>
                  )}
                </div>
              </div>
              {facts.length > 0 && (
                <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
                  {facts.map((fact) => (
                    <li
                      key={fact}
                      className="rounded-full bg-canvas px-2.5 py-1 text-[12px] font-semibold text-text-2"
                    >
                      {fact}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
