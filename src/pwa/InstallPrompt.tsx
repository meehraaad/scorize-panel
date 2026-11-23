import { lazy, Suspense, useEffect, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import {
  getAndroidPrompt,
  rememberInstallDismissal,
  subscribeToAndroidPrompt,
  type InstallPlatform,
} from './install';

const IphoneInstallGuide = lazy(() => import('./IphoneInstallGuide'));

export default function InstallPrompt({ platform }: { platform: InstallPlatform }) {
  const { t } = useTranslation('pwa');
  const androidPrompt = useSyncExternalStore(subscribeToAndroidPrompt, getAndroidPrompt);
  const [ready, setReady] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [failedPrompt, setFailedPrompt] = useState<typeof androidPrompt>(null);
  const nativePrompt =
    platform === 'android' && androidPrompt !== failedPrompt ? androidPrompt : null;

  function dismiss() {
    rememberInstallDismissal();
    setDismissed(true);
  }

  useEffect(() => {
    // Let the page settle and give Chrome time to announce installability.
    const timer = window.setTimeout(() => setReady(true), 2000);
    window.addEventListener('appinstalled', dismiss);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('appinstalled', dismiss);
    };
  }, []);

  async function install() {
    if (!nativePrompt || installing) return;
    setInstalling(true);
    try {
      await nativePrompt.prompt();
      dismiss();
    } catch {
      setFailedPrompt(nativePrompt);
    } finally {
      setInstalling(false);
    }
  }

  if (!ready) return null;

  if (platform !== 'android') {
    return (
      <Suspense fallback={null}>
        <IphoneInstallGuide
          open={!dismissed}
          onClose={dismiss}
          inSafari={platform === 'iphone-safari'}
        />
      </Suspense>
    );
  }

  return (
    <Dialog
      open={!dismissed}
      onClose={dismiss}
      title={t('title')}
      closeLabel={t('close')}
      footer={
        <>
          {nativePrompt && (
            <Button disabled={installing} onClick={() => void install()}>
              {t('install')}
            </Button>
          )}
          <Button variant={nativePrompt ? 'quiet' : 'outline'} onClick={dismiss}>
            {t('later')}
          </Button>
        </>
      }
    >
      {nativePrompt ? (
        <p className="text-body text-text-2">{t('android.intro')}</p>
      ) : (
        <ol className="list-decimal space-y-2 ps-5 text-body text-text-2">
          <li>{t('android.menu')}</li>
          <li>{t('android.addToHome')}</li>
          <li>{t('android.confirm')}</li>
        </ol>
      )}
    </Dialog>
  );
}
