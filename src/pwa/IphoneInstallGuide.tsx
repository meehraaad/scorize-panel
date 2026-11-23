import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Icon } from '@/components/ui/Icon';
import { copyText } from '@/lib/clipboard';
import { toast } from '@/lib/toast';
import styles from './IphoneInstallGuide.module.css';

function GuideIcon({ name }: { name: 'share' | 'add' | 'compass' | 'copy' }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {name === 'share' && <path d="M8 8H5.5v13h13V8H16M12 14V2m-4 4 4-4 4 4" />}
      {name === 'add' && (
        <>
          <rect x="4" y="4" width="16" height="16" rx="4" />
          <path d="M12 8.5v7m-3.5-3.5h7" />
        </>
      )}
      {name === 'compass' && (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="m15.5 8.5-2 5-5 2 2-5z" fill="currentColor" />
        </>
      )}
      {name === 'copy' && (
        <>
          <rect x="8" y="8" width="12" height="12" rx="2" />
          <path d="M16 5a1 1 0 0 0-1-1H6a2 2 0 0 0-2 2v9a1 1 0 0 0 1 1" />
        </>
      )}
    </svg>
  );
}

export default function IphoneInstallGuide({
  open,
  onClose,
  inSafari,
}: {
  open: boolean;
  onClose: () => void;
  inSafari: boolean;
}) {
  const { t } = useTranslation('pwa');
  const linkField = useRef<HTMLInputElement>(null);
  const panelLink = new URL(import.meta.env.BASE_URL, window.location.origin).href;
  const appIcon = new URL('icons/icon-192.png', panelLink).href;

  async function copyPanelLink() {
    const input = linkField.current;
    try {
      await copyText(panelLink, input?.closest('dialog') ?? document.body);
      toast.success(t('iphone.copied'));
    } catch {
      input?.focus();
      input?.select();
      toast.error(t('iphone.copyManually'));
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t(inSafari ? 'title' : 'iphone.openInSafari')}
      closeLabel={t('close')}
      size="wide"
      className={styles.dialog}
      footer={
        <div className={styles.actions}>
          {inSafari ? (
            <Button className={styles.button} variant="outline" onClick={onClose}>
              {t('iphone.gotIt')}
            </Button>
          ) : (
            <>
              <Button className={styles.button} onClick={() => void copyPanelLink()}>
                <GuideIcon name="copy" />
                {t('iphone.copyLink')}
              </Button>
              <Button className={styles.button} variant="quiet" onClick={onClose}>
                {t('iphone.continueHere')}
              </Button>
            </>
          )}
        </div>
      }
    >
      <div className={styles.guide}>
        <div className={styles.hero} aria-hidden="true">
          <div className={styles.orbit} />
          <div className={styles.phone}>
            {inSafari ? (
              <div className={styles.browserArt}>
                <img src={appIcon} alt="" width="42" height="42" />
                <div className={styles.toolbar}>
                  <Icon name="chevronStart" size={16} />
                  <span className={styles.shareTarget}>
                    <GuideIcon name="share" />
                  </span>
                  <Icon name="more" size={17} />
                </div>
              </div>
            ) : (
              <>
                <div className={styles.appGrid}>
                  <img src={appIcon} alt="" width="56" height="56" />
                  <span />
                  <span />
                  <span />
                </div>
                <div className={styles.homeIndicator} />
              </>
            )}
          </div>
          {!inSafari && (
            <div className={styles.badge}>
              <GuideIcon name="compass" />
            </div>
          )}
        </div>
        {inSafari ? (
          <ol className={styles.steps} role="list">
            <li>
              <span className={styles.stepIcon}>
                <GuideIcon name="share" />
              </span>
              <div>
                <h3>{t('iphone.share')}</h3>
                <p>{t('iphone.shareHint')}</p>
              </div>
            </li>
            <li>
              <span className={styles.stepIcon}>
                <GuideIcon name="add" />
              </span>
              <div>
                <h3>{t('iphone.addToHome')}</h3>
                <p>{t('iphone.addToHomeHint')}</p>
              </div>
            </li>
            <li>
              <span className={styles.stepIcon}>
                <Icon name="check" size={24} />
              </span>
              <div>
                <h3>{t('iphone.confirm')}</h3>
                <p>{t('iphone.confirmHint')}</p>
              </div>
            </li>
          </ol>
        ) : (
          <div className={styles.handoff}>
            <p>{t('iphone.handoff')}</p>
            <div className={styles.link}>
              <GuideIcon name="compass" />
              <input
                ref={linkField}
                type="text"
                dir="ltr"
                readOnly
                value={panelLink}
                aria-label={t('iphone.panelLink')}
                onFocus={(event) => event.currentTarget.select()}
              />
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}
