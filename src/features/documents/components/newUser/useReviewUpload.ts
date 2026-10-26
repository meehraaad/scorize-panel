import { useTranslation } from 'react-i18next';
import { checkFile } from '@/lib/files';
import { useFormat } from '@/lib/i18n/useFormat';
import {
  REVIEW_MAX_BYTES,
  REVIEW_TYPES,
  useUploadReviewDocument,
  type ReviewKind,
} from '@/lib/applicant/journey';
import { toast } from '@/lib/toast';

const RULE = { types: REVIEW_TYPES, maxBytes: REVIEW_MAX_BYTES };

/**
 * Sends one file of `kind` for the free review, at once, under the upload toast. A file the review
 * doesn't take says why in a toast (the buttons that send it sit in small cards).
 */
export function useReviewUpload() {
  const { t } = useTranslation('journey');
  const f = useFormat();
  const upload = useUploadReviewDocument();

  const send = (kind: ReviewKind, file: File | undefined) => {
    if (!file) return;
    const problem = checkFile(file, RULE);
    if (problem) {
      toast.error(
        problem === 'tooBig'
          ? t('review.tooBig', { size: f.fileSize(file.size), max: f.fileSize(REVIEW_MAX_BYTES) })
          : t('review.badType'),
      );
      return;
    }
    upload.mutate({
      kind,
      file,
      messages: { done: t('review.sent'), retry: () => send(kind, file) },
    });
  };

  return { send, pending: upload.isPending };
}
