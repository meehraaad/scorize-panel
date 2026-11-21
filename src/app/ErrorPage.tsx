import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useRouteError } from 'react-router';
import { buttonClass } from '@/components/ui/buttonStyles';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { START_PATH } from '@/lib/auth/session';
import { usePageSkeleton } from '@/lib/router/lazyPage';
import { reloadForNewBuild, shouldReloadFor } from '@/lib/router/staleBuild';
import { reportClientCrash } from '@/lib/clientErrors';
import { missingOf, supportCodeOf } from './routeFailure';

function useRouteFailure() {
  const error = useRouteError();
  const missing = missingOf(error);
  const notFound = missing !== null;
  // Code from before a deploy: reload once into the new build (lib/router/staleBuild.ts).
  // Decided once, so the reload's own bookkeeping can't flip it to the error mid-way.
  const [reloading] = useState(() => shouldReloadFor(error));
  useEffect(() => {
    if (reloading) reloadForNewBuild();
  }, [reloading]);
  if (!notFound && !reloading) console.error(error);
  // The panel's own crash: reported, and its code shown once the server answers.
  const [crashCode, setCrashCode] = useState<string | null>(null);
  useEffect(() => {
    if (reloading || notFound) return;
    let current = true;
    void reportClientCrash(error).then((code) => {
      if (current) setCrashCode(code);
    });
    return () => {
      current = false;
    };
  }, [error, reloading, notFound]);
  return { notFound, missing, reloading, code: supportCodeOf(error) ?? crashCode };
}

/** The request's ID, for support to find the failure in the server's logs (scorize docs/request-ids.md). */
function SupportCode({ code }: { code: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex w-full items-center justify-between gap-4 rounded-2xl border border-hair bg-surface px-4 py-3">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-small text-text-2">{t('errors.supportCode')}</span>
        <code dir="ltr" className="truncate text-start font-bold tracking-wide">
          {code}
        </code>
      </div>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard
            .writeText(code)
            .then(() => setCopied(true))
            .catch(() => {});
        }}
        className={buttonClass('outline', 'flex-none')}
      >
        {copied ? t('errors.codeCopied') : t('errors.copyCode')}
      </button>
    </div>
  );
}

/**
 * Last-resort boundary for a whole layout (the shell itself failed). Also catches failed lazy
 * chunks: after a deploy it reloads into the new files by itself; on a bad network it offers to.
 */
export function ErrorPage() {
  const { t } = useTranslation();
  const { notFound, reloading, code } = useRouteFailure();
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
      {code && <SupportCode code={code} />}
    </div>
  );
}

/** Boundary inside a panel: only the page area is replaced, the header and menus keep working. */
export function SectionError() {
  const { t } = useTranslation();
  const { missing, reloading, code } = useRouteFailure();
  const skeleton = usePageSkeleton();
  if (missing) return <NotFoundPage inactive={missing === 'inactive'} />;
  if (reloading) return <PageSkeleton kind={skeleton} />;

  return (
    <Card className="flex flex-col items-start gap-4 p-6 lg:p-8" role="alert">
      <h1 className="m-0 font-display text-xl font-bold">{t('errors.sectionTitle')}</h1>
      <p className="m-0 text-[15px] leading-7 text-text-2">{t('errors.sectionBody')}</p>
      <button type="button" onClick={() => window.location.reload()} className={buttonClass()}>
        {t('errors.retry')}
      </button>
      {code && <SupportCode code={code} />}
    </Card>
  );
}

export function NotFoundPage({ inactive = false }: { inactive?: boolean }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t(inactive ? 'errors.inactiveTitle' : 'errors.notFoundTitle')}
        subtitle={t(inactive ? 'errors.inactiveBody' : 'errors.notFoundBody')}
      />
      <div>
        <Link to={START_PATH} className={buttonClass()}>
          {t('errors.backHome')}
        </Link>
      </div>
    </div>
  );
}
