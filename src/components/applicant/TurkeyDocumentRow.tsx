import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileDrop } from '@/components/ui/Files';
import { Icon, type IconName } from '@/components/ui/Icon';
import { checkFile, type FileProblem } from '@/lib/files';
import { useFormat } from '@/lib/i18n/useFormat';
import {
  MAX_TURKEY_UPLOAD_BYTES,
  TURKEY_UPLOAD_TYPES,
  useUploadTurkeyDocument,
  type TurkeyDocument,
  type TurkeyDocumentStatus,
} from '@/lib/applicant/turkey';

const RULE = { types: TURKEY_UPLOAD_TYPES, maxBytes: MAX_TURKEY_UPLOAD_BYTES };

const LOOK: Record<TurkeyDocumentStatus, { icon: IconName; tone: string }> = {
  missing: { icon: 'upload', tone: 'bg-neutral-tint text-text-2' },
  uploaded: { icon: 'check', tone: 'bg-tint text-primary-text' },
  review: { icon: 'clock', tone: 'bg-info-tint text-info' },
  approved: { icon: 'check', tone: 'bg-good-tint text-good' },
  rejected: { icon: 'alert', tone: 'bg-warn-tint text-warn' },
};

/**
 * One Turkey document: its state, the team's note when it was sent back, and the upload (the file
 * goes up as soon as it is picked and straight to the team). Locked while the team has it or once
 * approved. On the Turkey page and in the documents tab's list, where `tagged` says the Turkey
 * request needs it.
 */
export function TurkeyDocumentRow({
  doc,
  tagged = false,
}: {
  doc: TurkeyDocument;
  tagged?: boolean;
}) {
  const { t } = useTranslation('turkey');
  const f = useFormat();
  const upload = useUploadTurkeyDocument();
  const [problem, setProblem] = useState<{ problem: FileProblem; size: number } | null>(null);
  const inputId = `turkey-doc-${String(doc.id)}`;
  const errorId = `${inputId}-error`;
  const look = LOOK[doc.status];
  // The team has it, or approved it: nothing to change.
  const locked = doc.status === 'review' || doc.status === 'approved';

  const choose = (file: File | undefined) => {
    if (!file) return;
    const found = checkFile(file, RULE);
    if (found) {
      setProblem({ problem: found, size: file.size });
      return;
    }
    setProblem(null);
    send(file);
  };
  const send = (file: File) =>
    upload.mutate({
      id: doc.id,
      file,
      messages: { failed: t('docs.uploadError'), retry: () => send(file) },
    });

  const meta =
    doc.status === 'missing'
      ? [doc.required ? tagged && t('docs.needed') : t('docs.optional'), doc.hint]
          .filter(Boolean)
          .join(' · ')
      : t(`docs.status.${doc.status}`, { file: doc.file_name ?? '' });

  return (
    <li
      className={`flex flex-col gap-3 px-5 py-4 shadow-[inset_0_1px_0_var(--hair)] lg:px-8 lg:py-[18px] ${
        doc.status === 'rejected' ? 'bg-row-highlight' : ''
      }`}
    >
      <div className="flex flex-wrap items-center gap-3">
        <span
          aria-hidden="true"
          className={`flex size-10 flex-none items-center justify-center rounded-full ${look.tone}`}
        >
          <Icon name={look.icon} size={18} />
        </span>
        <span className="flex min-w-0 flex-[1_1_220px] flex-col gap-0.5">
          <span className="text-[15px] font-semibold">{doc.name}</span>
          <span className="text-[13px] leading-6 text-text-2">{meta}</span>
        </span>
        {!locked &&
          (upload.isPending ? (
            <span className="text-sm text-text-2">{t('docs.uploading')}</span>
          ) : (
            <FileDrop
              id={inputId}
              compact
              accept={TURKEY_UPLOAD_TYPES}
              errorId={problem ? errorId : null}
              chooseLabel={t(
                doc.status === 'rejected'
                  ? 'docs.reupload'
                  : doc.status === 'uploaded'
                    ? 'docs.replace'
                    : 'docs.upload',
              )}
              inputLabel={t('docs.uploadLabel', { name: doc.name })}
              onFile={choose}
            />
          ))}
      </div>
      {doc.status === 'rejected' && doc.note && (
        <p className="m-0 rounded-[14px] bg-warn-tint px-4 py-3 text-sm leading-7 text-warn">
          <span className="font-semibold">{t('docs.noteLabel')}</span> {doc.note}
        </p>
      )}
      {problem && (
        <p id={errorId} className="m-0 text-sm leading-6 text-danger">
          {problem.problem === 'tooBig'
            ? t('docs.tooBig', {
                size: f.fileSize(problem.size),
                max: f.fileSize(MAX_TURKEY_UPLOAD_BYTES),
              })
            : t('docs.badType')}
        </p>
      )}
    </li>
  );
}
