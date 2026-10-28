import { useTranslation } from 'react-i18next';
import { TurkeyDocumentRow } from '@/components/applicant/TurkeyDocumentRow';
import { ProgressBar } from '@/components/ui/Progress';
import { SectionCard } from '@/components/ui/SectionCard';
import { useFormat } from '@/lib/i18n/useFormat';
import { percentOf } from '@/lib/progress';
import type { TurkeyCase, TurkeyDocument } from '@/lib/applicant/turkey';

/** A document still needs the applicant: nothing sent yet, or sent back by the team. */
const needsFile = (doc: TurkeyDocument) =>
  doc.required && (doc.status === 'missing' || doc.status === 'rejected');

/**
 * Steps 2 and 3: upload each document; it goes up as soon as it is picked and straight to the team
 * (docs/backend-changes.md H75). The list shows each verdict; a document sent back can be uploaded
 * again.
 */
export function DocsStep({ data }: { data: TurkeyCase }) {
  const { t } = useTranslation('turkey');
  const { t: tc } = useTranslation();
  const f = useFormat();
  const review = data.step === 'review';
  const required = data.documents.filter((doc) => doc.required);
  const approved = data.documents.filter((doc) => doc.status === 'approved').length;
  const rejected = data.documents.filter((doc) => doc.status === 'rejected').length;
  const ready = required.filter((doc) => !needsFile(doc)).length;

  const degree = data.answers ? tc(`degree.${data.answers.degree}`) : '';

  return (
    <>
      <div className="flex flex-col gap-2.5">
        <h1 className="m-0 font-display text-2xl leading-snug font-bold lg:text-[32px]">
          {t(review ? 'docs.reviewTitle' : 'docs.title')}
        </h1>
        <p className="m-0 text-base leading-8 text-text-2">
          {review
            ? [
                t('docs.reviewSubtitle', {
                  approved: f.number(approved),
                  total: f.number(data.documents.length),
                }),
                rejected > 0 && t('docs.reviewRejected', { n: f.number(rejected) }),
              ]
                .filter(Boolean)
                .join(' ')
            : t('docs.subtitle', { degree })}
        </p>
      </div>

      <SectionCard
        id="turkey-docs"
        title={t('docs.label')}
        end={
          <div className="flex min-w-[180px] items-center gap-2.5">
            <ProgressBar
              value={percentOf(
                review ? approved : ready,
                review ? data.documents.length : required.length,
              )}
              tone={review ? 'good' : 'primary'}
              className="flex-1"
            />
            <span className="text-sm font-semibold whitespace-nowrap">
              {review
                ? t('docs.progressApproved', {
                    done: f.number(approved),
                    total: f.number(data.documents.length),
                  })
                : t('docs.progress', { done: f.number(ready), total: f.number(required.length) })}
            </span>
          </div>
        }
      >
        <ul className="m-0 list-none p-0">
          {data.documents.map((doc) => (
            <TurkeyDocumentRow key={doc.id} doc={doc} />
          ))}
        </ul>
        <p className="m-0 px-5 py-[18px] text-sm leading-7 text-text-2 shadow-[inset_0_1px_0_var(--hair)] lg:px-8 lg:py-[22px]">
          {t(review ? 'docs.reviewFooter' : 'docs.footer')}
        </p>
      </SectionCard>
    </>
  );
}
