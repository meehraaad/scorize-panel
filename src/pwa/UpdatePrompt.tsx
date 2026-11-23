import { lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from '@/components/ui/Button';
import { installPlatform } from './install';

const InstallPrompt = installPlatform ? lazy(() => import('./InstallPrompt')) : null;

/**
 * Service-worker registration and the PWA prompts.
 * We never auto-reload: the user might be halfway through a form.
 */
export default function UpdatePrompt() {
  const { t } = useTranslation();
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  return (
    <>
      {needRefresh && (
        <div
          role="status"
          className="fixed inset-x-4 bottom-[calc(88px+env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-md items-center justify-between gap-3 rounded-card-sm bg-hero p-4 text-on-hero shadow-hero lg:bottom-6"
        >
          <span className="text-[15px]">{t('update.available')}</span>
          <Button onClick={() => void updateServiceWorker(true)}>{t('update.reload')}</Button>
        </div>
      )}
      {InstallPrompt && installPlatform && (
        <Suspense fallback={null}>
          <InstallPrompt platform={installPlatform} />
        </Suspense>
      )}
    </>
  );
}
