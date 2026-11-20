import { Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { StageDialog } from '@/components/ui/StageDialog';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { PathwayQuiz } from './PathwayQuiz';

/** The pathway finder in a popup over the page that opened it (a sheet on phones). */
export function PathwayQuizDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation('pathways');
  return (
    <StageDialog open={open} onClose={onClose} title={t('title')}>
      <Suspense
        fallback={
          <div className="p-6 lg:p-14">
            <SkeletonRows rows={4} />
          </div>
        }
      >
        <PathwayQuiz host="dialog" onClose={onClose} />
      </Suspense>
    </StageDialog>
  );
}
