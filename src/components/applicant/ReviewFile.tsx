import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Chip } from '@/components/ui/Chip';
import { FileTile } from '@/components/ui/Files';
import { IconButton } from '@/components/ui/IconButton';
import { InlineConfirm } from '@/components/ui/InlineConfirm';
import { useFormat } from '@/lib/i18n/useFormat';
import { useDeleteReviewDocument, type ReviewDocument } from '@/lib/applicant/journey';
import { toast } from '@/lib/toast';

/**
 * One file sent for the free review (home and documents tab): what it is, when it was sent, and
 * delete after an inline confirm. A list item; the list spans two columns from `xl`.
 */
export function ReviewFile({ file }: { file: ReviewDocument }) {
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
