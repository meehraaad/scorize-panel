import { useTranslation } from 'react-i18next';
import { SectionCard } from '@/components/ui/SectionCard';
import { useFormat } from '@/lib/i18n/useFormat';

const STEPS = ['pick', 'approve', 'result'] as const;

/** The page's three steps, for a case with no application yet and for a locked page. */
export function HowItWorks() {
  const { t } = useTranslation('applications');
  const f = useFormat();
  return (
    <SectionCard id="apps-how" variant="panel" title={t('how.title')}>
      <ol className="m-0 grid list-none gap-4 p-0 md:grid-cols-3">
        {STEPS.map((step, index) => (
          <li key={step} className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className="flex size-9 flex-none items-center justify-center rounded-xl bg-tint font-bold text-primary-text"
            >
              {f.number(index + 1)}
            </span>
            <span className="flex flex-col">
              <span className="font-semibold">{t(`how.${step}.title`)}</span>
              <span className="text-[13px] leading-6 text-text-2">{t(`how.${step}.text`)}</span>
            </span>
          </li>
        ))}
      </ol>
    </SectionCard>
  );
}
