import { useTranslation } from 'react-i18next';
import { checkFile } from '@/lib/files';
import { useFormat } from '@/lib/i18n/useFormat';
import {
  MAX_TURKEY_UPLOAD_BYTES,
  TURKEY_UPLOAD_TYPES,
  useUploadTurkeyDocument,
  type TurkeyDocument,
} from '@/lib/applicant/turkey';
import { toast } from '@/lib/toast';

const RULE = { types: TURKEY_UPLOAD_TYPES, maxBytes: MAX_TURKEY_UPLOAD_BYTES };

/**
 * Sends one Turkey document from the hero or the status card, at once and straight to the team
 * (backend item H75). A file it doesn't take says why in a toast.
 */
export function useTurkeyUpload() {
  const { t } = useTranslation('turkey');
  const f = useFormat();
  const upload = useUploadTurkeyDocument();

  const send = (doc: TurkeyDocument, file: File | undefined) => {
    if (!file) return;
    const problem = checkFile(file, RULE);
    if (problem) {
      toast.error(
        problem === 'tooBig'
          ? t('docs.tooBig', {
              size: f.fileSize(file.size),
              max: f.fileSize(MAX_TURKEY_UPLOAD_BYTES),
            })
          : t('docs.badType'),
      );
      return;
    }
    upload.mutate({
      id: doc.id,
      file,
      messages: { failed: t('docs.uploadError'), retry: () => send(doc, file) },
    });
  };

  return { send, pending: upload.isPending };
}

/** The next document Turkey needs from the applicant: sent back first, then not sent yet. */
export const nextTurkeyDoc = (documents: TurkeyDocument[]) =>
  documents.find((doc) => doc.required && doc.status === 'rejected') ??
  documents.find((doc) => doc.required && doc.status === 'missing');
