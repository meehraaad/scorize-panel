import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/ui/Icon';
import { SectionCard } from '@/components/ui/SectionCard';
import { useFormat } from '@/lib/i18n/useFormat';
import type { OrderData } from '../api';

/** The applicant's information form, read-only: one collapsible part per section (the first open). */
export function ApplicantForm({ form }: { form: OrderData['form'] }) {
  const { t } = useTranslation('writer');
  const f = useFormat();
  return (
    <SectionCard
      variant="panel"
      size="lg"
      id="writer-form"
      title={t('form.title')}
      subtitle={
        form.submitted_at
          ? t('form.submitted', { date: f.dateShort(form.submitted_at) })
          : t('form.notYet')
      }
    >
      {form.sections.length === 0 ? (
        <p className="m-0 text-sm leading-7 text-text-2">{t('form.empty')}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {form.sections.map((section, index) => (
            <details
              key={section.title}
              open={index === 0}
              className="group rounded-[18px] shadow-[inset_0_0_0_1px_var(--hair)]"
            >
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-[15px] font-semibold">{section.title}</span>
                  <span className="text-[13px] text-text-2">{section.summary}</span>
                </span>
                <Icon
                  name="chevronDown"
                  size={18}
                  className="flex-none text-text-2 transition-transform group-open:rotate-180"
                />
              </summary>
              <dl className="m-0 flex flex-col gap-3.5 px-4 pt-1 pb-4">
                {section.answers.map((answer) => (
                  <div key={answer.question} className="flex flex-col gap-1">
                    <dt className="text-[13px] text-text-2">{answer.question}</dt>
                    <dd className="m-0 text-[15px] leading-8 whitespace-pre-line">
                      <bdi>{answer.answer}</bdi>
                    </dd>
                  </div>
                ))}
              </dl>
            </details>
          ))}
        </div>
      )}
    </SectionCard>
  );
}
