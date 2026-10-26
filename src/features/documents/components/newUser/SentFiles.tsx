import { useTranslation } from 'react-i18next';
import { ReviewFile } from '@/components/applicant/ReviewFile';
import { SectionCard } from '@/components/ui/SectionCard';
import { useFormat } from '@/lib/i18n/useFormat';
import type { ReviewDocument } from '@/lib/applicant/journey';

/** The files sent for the free review, each with its delete. */
export function SentFiles({ files }: { files: ReviewDocument[] }) {
  const { t } = useTranslation('documents');
  const f = useFormat();
  if (files.length === 0) return null;
  return (
    <SectionCard
      id="docs-sent"
      title={t('newUser.sent.title')}
      end={
        <span className="text-[13px] text-text-2">
          {t('newUser.sent.count', { n: f.number(files.length) })}
        </span>
      }
    >
      <ul className="m-0 grid list-none grid-cols-1 gap-3 px-5 pt-2 pb-5 lg:px-8 lg:pb-7 xl:grid-cols-2">
        {files.map((file) => (
          <ReviewFile key={file.id} file={file} />
        ))}
      </ul>
    </SectionCard>
  );
}
