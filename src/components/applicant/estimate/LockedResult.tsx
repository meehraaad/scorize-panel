import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/ui/Icon';
import type { EstimateOptions } from '@/lib/applicant/estimate';

/** Bar lengths of the sample: a shape, not anyone's chance. */
const SHAPE = ['w-[88%]', 'w-[70%]', 'w-[62%]', 'w-[44%]'];

/**
 * Beside the first question: what the result will look like, locked. The countries are real
 * options; the bars are a blurred sample shape. Curiosity about their own numbers is the reason
 * to finish. Design: "Scorize New User Dashboard v2" canvas, FirstVisit.
 */
export function LockedResult({ options }: { options: EstimateOptions }) {
  const { t } = useTranslation('estimate');
  const countries = options.countries.slice(0, SHAPE.length);
  return (
    <section
      aria-labelledby="estimate-locked"
      className="flex flex-col gap-4 rounded-[24px] bg-surface p-5 shadow-panel lg:p-6"
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex size-9 flex-none items-center justify-center rounded-xl bg-tint text-primary-text"
        >
          <Icon name="lock" size={16} />
        </span>
        <h2 id="estimate-locked" className="m-0 text-base font-bold">
          {t('locked.title')}
        </h2>
      </div>
      <ul aria-hidden="true" className="m-0 flex list-none flex-col gap-3 p-0">
        {countries.map((country, index) => (
          <li key={country.id} className="grid grid-cols-[88px_1fr] items-center gap-3 text-sm">
            <span className="truncate font-semibold">{country.name}</span>
            <span className="h-2.5 rounded-full bg-canvas">
              <span
                className={`block h-full rounded-full bg-primary/40 blur-[2px] ${SHAPE[index] ?? ''}`}
              />
            </span>
          </li>
        ))}
      </ul>
      <p className="m-0 text-[13px] leading-6 text-text-2">{t('locked.text')}</p>
    </section>
  );
}
