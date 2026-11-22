import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '@/components/ui/EmptyState';
import { FileTile } from '@/components/ui/Files';
import { SectionCard } from '@/components/ui/SectionCard';
import { extensionOf } from '@/lib/files';
import { Facts } from '../../components/Facts';
import { useAnswerText } from '../answerText';
import type { OnboardingAnswers, OnboardingFile } from '../api';
import { FIELDS, FILE_KINDS, SECTIONS, isAsked, type FieldKey } from '../fields';

/**
 * A sent form, read only: each section's answers, then the documents. `compare`: what the staff
 * file has now where it differs (HR sees it before approving).
 */
export function AnswersSummary({
  answers,
  files,
  compare = {},
}: {
  answers: OnboardingAnswers;
  files: readonly OnboardingFile[];
  compare?: Partial<Record<FieldKey, ReactNode>>;
}) {
  const { t } = useTranslation('hr');
  const text = useAnswerText();
  return (
    <>
      {SECTIONS.filter((section) => section !== 'documents').map((section) => (
        <SectionCard
          key={section}
          id={`onb-summary-${section}`}
          title={t(`onboarding.section.${section}`)}
        >
          <Facts
            label={t(`onboarding.section.${section}`)}
            rows={FIELDS.filter(
              (field) => field.section === section && isAsked(field.key, answers),
            ).map((field) => [
              t(`onboarding.field.${field.key}`),
              compare[field.key] ? (
                <span className="flex flex-col gap-0.5">
                  <span>{text(field.key, answers) || '–'}</span>
                  <span className="text-label font-normal text-warn">
                    {t('onboarding.review.differs', { value: compare[field.key] })}
                  </span>
                </span>
              ) : (
                text(field.key, answers)
              ),
            ])}
          />
        </SectionCard>
      ))}
      <SectionCard id="onb-summary-documents" title={t('onboarding.section.documents')}>
        <div className="flex flex-col gap-4 px-5 pb-5 lg:px-8">
          {FILE_KINDS.map((kind) => {
            const mine = files.filter((file) => file.kind === kind);
            return (
              <div key={kind} className="flex flex-col gap-2">
                <h3 className="m-0 text-small font-semibold text-text-2">
                  {t(`onboarding.file.${kind}`)}
                </h3>
                {mine.length === 0 ? (
                  <EmptyState variant="inset">{t('onboarding.file.missing')}</EmptyState>
                ) : (
                  mine.map((file) => (
                    <FileTile
                      key={file.id}
                      ext={extensionOf(file.name)}
                      name={file.name}
                      href={file.url ?? ''}
                      meta={t('onboarding.file.open')}
                    />
                  ))
                )}
              </div>
            );
          })}
        </div>
      </SectionCard>
    </>
  );
}
