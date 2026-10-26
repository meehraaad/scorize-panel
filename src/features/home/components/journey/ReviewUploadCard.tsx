import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChoiceGroup } from '@/components/ui/Choices';
import { FileDrop, FileTile } from '@/components/ui/Files';
import { IconButton } from '@/components/ui/IconButton';
import { InlineConfirm } from '@/components/ui/InlineConfirm';
import { SectionCard } from '@/components/ui/SectionCard';
import { Chip } from '@/components/ui/Chip';
import { checkFile, type FileProblem } from '@/lib/files';
import { useFormat } from '@/lib/i18n/useFormat';
import {
  MAX_REVIEW_DOCUMENTS,
  REVIEW_KINDS,
  REVIEW_MAX_BYTES,
  REVIEW_TYPES,
  useDeleteReviewDocument,
  useUploadReviewDocument,
  type ReviewDocument,
  type ReviewKind,
} from '@/lib/applicant/journey';
import { toast } from '@/lib/toast';

const RULE = { types: REVIEW_TYPES, maxBytes: REVIEW_MAX_BYTES };

/**
 * Files for a free review of the case, without a contract: a transcript or CV is the strongest
 * sign someone is ready, so each upload reaches a seller (Django makes a lead). Pick what the file
 * is, then the file; it is sent at once under the upload toast.
 */
export function ReviewUploadCard({
  files,
  kind: chosen,
  onKind,
}: {
  files: ReviewDocument[];
  /** The kind picked, when the page picks it too (the Turkey checklist's "upload passport"). */
  kind?: ReviewKind;
  onKind?: (kind: ReviewKind) => void;
}) {
  const { t } = useTranslation('journey');
  const f = useFormat();
  const upload = useUploadReviewDocument();
  const [own, setOwn] = useState<ReviewKind>('transcript');
  const kind = chosen ?? own;
  const setKind = onKind ?? setOwn;
  const [problem, setProblem] = useState<{ problem: FileProblem; size: number } | null>(null);
  const full = files.length >= MAX_REVIEW_DOCUMENTS;

  const send = (file: File | undefined) => {
    if (!file) return;
    const found = checkFile(file, RULE);
    setProblem(found ? { problem: found, size: file.size } : null);
    if (found) return;
    upload.mutate({ kind, file, messages: { done: t('review.sent'), retry: () => send(file) } });
  };

  return (
    <SectionCard id="review-upload" title={t('review.title')} subtitle={t('review.subtitle')}>
      <div className="flex flex-col gap-4 px-5 pt-2 pb-5 lg:px-8 lg:pb-7">
        {full ? (
          <p className="m-0 text-sm leading-7 text-text-2">{t('review.tooMany')}</p>
        ) : (
          <>
            <ChoiceGroup
              legend={t('review.kind')}
              options={REVIEW_KINDS.map((value) => ({ value, label: t(`review.kinds.${value}`) }))}
              value={kind}
              onChange={setKind}
            />
            <FileDrop
              id="review-file"
              accept={REVIEW_TYPES}
              disabled={upload.isPending}
              errorId={problem ? 'review-file-error' : null}
              chooseLabel={t('review.choose')}
              inputLabel={t('review.chooseFor', { kind: t(`review.kinds.${kind}`) })}
              hint={t('review.dropHint')}
              touchHint={t('review.dropHintTouch')}
              onFile={send}
            />
            {problem ? (
              <p id="review-file-error" className="m-0 text-sm leading-7 text-danger">
                {problem.problem === 'tooBig'
                  ? t('review.tooBig', {
                      size: f.fileSize(problem.size),
                      max: f.fileSize(REVIEW_MAX_BYTES),
                    })
                  : t('review.badType')}
              </p>
            ) : (
              <p className="m-0 text-[13px] text-text-2">
                {t('review.rule', { size: f.fileSize(REVIEW_MAX_BYTES) })}
              </p>
            )}
          </>
        )}

        {files.length > 0 && (
          <ul
            aria-label={t('review.list')}
            className="m-0 grid list-none grid-cols-1 gap-3 p-0 xl:grid-cols-2"
          >
            {files.map((file) => (
              <ReviewFile key={file.id} file={file} />
            ))}
          </ul>
        )}
      </div>
    </SectionCard>
  );
}

function ReviewFile({ file }: { file: ReviewDocument }) {
  const { t } = useTranslation('journey');
  const f = useFormat();
  const remove = useDeleteReviewDocument();
  const [confirming, setConfirming] = useState(false);
  const name = t(`review.kinds.${file.kind}`);

  if (confirming)
    return (
      <li className="xl:col-span-2">
        <InlineConfirm
          message={t('review.confirm', { name })}
          confirmLabel={t('review.confirmYes')}
          cancelLabel={t('review.confirmNo')}
          pending={remove.isPending}
          onConfirm={() =>
            remove.mutate(file.id, {
              onSuccess: () => toast.success(t('review.deleted')),
              onError: () => {
                setConfirming(false);
                toast.error(t('review.deleteError'));
              },
            })
          }
          onCancel={() => setConfirming(false)}
        />
      </li>
    );

  return (
    <li className="min-w-0">
      <FileTile
        ext={file.ext}
        name={name}
        href={file.url}
        meta={f.dateShort(file.uploaded_at)}
        actions={
          <>
            <Chip tone="info" small>
              {t('review.waiting')}
            </Chip>
            <IconButton
              icon="trash"
              tone="danger"
              aria-label={t('review.delete', { name })}
              onClick={() => setConfirming(true)}
            />
          </>
        }
      />
    </li>
  );
}
