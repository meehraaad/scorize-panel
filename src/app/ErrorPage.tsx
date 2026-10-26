import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, isRouteErrorResponse, useRouteError } from 'react-router';
import { buttonClass } from '@/components/ui/buttonStyles';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { START_PATH } from '@/lib/auth/session';
import { usePageSkeleton } from '@/lib/router/lazyPage';
import { reloadForNewBuild, shouldReloadFor } from '@/lib/router/staleBuild';

function useRouteFailure() {
  const error = useRouteError();
  const notFound = isRouteErrorResponse(error) && error.status === 404;
  // Code from before a deploy: reload once into the new build (lib/router/staleBuild.ts).
  // Decided once, so the reload's own bookkeeping can't flip it to the error mid-way.
  const [reloading] = useState(() => shouldReloadFor(error));
  useEffect(() => {
    if (reloading) reloadForNewBuild();
  }, [reloading]);
  if (!notFound && !reloading) console.error(error);
  return { notFound, reloading };
}

/**
 * Last-resort boundary for a whole layout (the shell itself failed). Also catches failed lazy
 * chunks: after a deploy it reloads into the new files by itself; on a bad network it offers to.
 */
export function ErrorPage() {
  const { t } = useTranslation();
  const { notFound, reloading } = useRouteFailure();
  if (reloading) return null;

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-16">
      <PageHeader
        title={t(notFound ? 'errors.notFoundTitle' : 'errors.title')}
        subtitle={t(notFound ? 'errors.notFoundBody' : 'errors.body')}
      />
      <div className="flex flex-wrap gap-2">
        {!notFound && (
          <button type="button" onClick={() => window.location.reload()} className={buttonClass()}>
            {t('errors.retry')}
          </button>
        )}
        <Link to={START_PATH} className={buttonClass(notFound ? 'primary' : 'outline')}>
          {t('errors.backHome')}
        </Link>
      </div>
    </div>
  );
}

/** Boundary inside a panel: only the page area is replaced, the header and menus keep working. */
export function SectionError() {
  const { t } = useTranslation();
  const { notFound, reloading } = useRouteFailure();
  const skeleton = usePageSkeleton();
  if (notFound) return <NotFoundPage />;
  if (reloading) return <PageSkeleton kind={skeleton} />;

  return (
    <Card className="flex flex-col items-start gap-4 p-6 lg:p-8" role="alert">
      <h1 className="m-0 font-display text-xl font-bold">{t('errors.sectionTitle')}</h1>
      <p className="m-0 text-[15px] leading-7 text-text-2">{t('errors.sectionBody')}</p>
      <button type="button" onClick={() => window.location.reload()} className={buttonClass()}>
        {t('errors.retry')}
      </button>
    </Card>
  );
}

export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t('errors.notFoundTitle')} subtitle={t('errors.notFoundBody')} />
      <div>
        <Link to={START_PATH} className={buttonClass()}>
          {t('errors.backHome')}
        </Link>
      </div>
    </div>
  );
}
