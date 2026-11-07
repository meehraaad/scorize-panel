import { useQuery } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { InlineConfirm } from '@/components/ui/InlineConfirm';
import { Notice } from '@/components/ui/Notice';
import { mobileExtensionQuery, useRequestMobileExtension } from '@/lib/sales/phoneCalls';
import { toast } from '@/lib/toast';

/** One login detail in a read-only field, with copy (and, for the password, show/hide) inside it. */
function CopyRow({
  label,
  value,
  secret,
}: {
  label: string;
  value: string;
  /** The password: hidden until the eye inside the field is pressed. */
  secret?: { shown: boolean; toggle: () => void };
}) {
  const { t } = useTranslation('sales');
  const [copied, setCopied] = useState(false);
  const shown = !secret || secret.shown;
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <dt className="text-sm font-medium text-text-2">{label}</dt>
      <dd
        dir="ltr"
        className="m-0 flex h-12 items-center gap-1 rounded-2xl bg-surface ps-4 pe-0.5 shadow-[inset_0_0_0_1px_var(--line-2)]"
      >
        <code
          className={`min-w-0 flex-1 truncate font-mono text-base ${shown ? 'text-text' : 'tracking-widest text-text-3'}`}
        >
          {shown ? value : '••••••••••'}
        </code>
        {secret && (
          <IconButton
            icon={secret.shown ? 'eyeOff' : 'eye'}
            tone="muted"
            iconSize={18}
            aria-label={secret.shown ? t('mobileExtension.hide') : t('mobileExtension.show')}
            aria-pressed={secret.shown}
            onClick={secret.toggle}
          />
        )}
        <IconButton
          icon={copied ? 'check' : 'document'}
          tone="muted"
          iconSize={18}
          aria-label={t('mobileExtension.copy', { label })}
          onClick={() => {
            void navigator.clipboard
              .writeText(value)
              .then(() => {
                setCopied(true);
                window.setTimeout(() => setCopied(false), 2000);
              })
              .catch(() => setCopied(false));
          }}
        />
      </dd>
    </div>
  );
}

/** Linphone reads its whole setup from this link, so scanning is all the seller does. */
function LinphoneQr({ link }: { link: string }) {
  const { t } = useTranslation('sales');
  return (
    <section className="flex flex-col items-center gap-4 rounded-3xl bg-tint p-5 sm:flex-row sm:items-start">
      {/* Black on white whatever the theme: phone cameras read that best. */}
      <div className="flex-none rounded-2xl bg-white p-3">
        <QRCodeSVG
          value={link}
          size={176}
          level="M"
          bgColor="#ffffff"
          fgColor="#000000"
          role="img"
          aria-label={t('mobileExtension.qrLabel')}
        />
      </div>
      <div className="flex min-w-0 flex-col gap-2">
        <h3 className="m-0 font-display text-base font-bold">{t('mobileExtension.qrTitle')}</h3>
        <p className="m-0 text-[15px] leading-7 text-text-2">{t('mobileExtension.qrSteps')}</p>
        <p className="m-0 text-sm leading-7 text-text-2">{t('mobileExtension.qrAndroid')}</p>
        <p className="m-0 text-sm leading-7 text-text-3">{t('mobileExtension.qrExpiry')}</p>
      </div>
    </section>
  );
}

/** Settings: the seller's own mobile login, made on the office PBX when they ask for it. */
export function MobileExtension() {
  const { t } = useTranslation('sales');
  const { data } = useQuery(mobileExtensionQuery);
  const request = useRequestMobileExtension();
  const [revealed, setRevealed] = useState(false);
  const [confirming, setConfirming] = useState(false);

  if (!data?.available) return null;
  const send = (reset: boolean) =>
    request.mutate(reset, {
      onSuccess: () => {
        setConfirming(false);
        setRevealed(false);
      },
      onError: () => toast.error(t('mobileExtension.error')),
    });

  return (
    <div className="flex flex-col gap-3">
      <h2 className="mb-3 font-display text-lg font-bold">{t('mobileExtension.title')}</h2>
      {data.status === 'none' && (
        <>
          <p className="m-0 text-[15px] leading-7 text-text-2">{t('mobileExtension.intro')}</p>
          <div>
            <Button disabled={request.isPending} onClick={() => send(false)}>
              {t('mobileExtension.request')}
            </Button>
          </div>
        </>
      )}
      {data.status === 'pending' && <Notice tone="info">{t('mobileExtension.pending')}</Notice>}
      {data.status === 'failed' && (
        <>
          <Notice tone="error">{t('mobileExtension.failed')}</Notice>
          <div>
            <Button disabled={request.isPending} onClick={() => send(false)}>
              {t('mobileExtension.retry')}
            </Button>
          </div>
        </>
      )}
      {data.status === 'ready' && data.extension && data.password && (
        <>
          {data.linphone && <LinphoneQr link={data.linphone} />}
          <p className="m-0 text-[15px] leading-7 text-text-2">{t('mobileExtension.setup')}</p>
          <dl className="m-0 grid gap-4 sm:grid-cols-2">
            <CopyRow label={t('mobileExtension.extension')} value={data.extension} />
            <CopyRow
              label={t('mobileExtension.password')}
              value={data.password}
              secret={{ shown: revealed, toggle: () => setRevealed((value) => !value) }}
            />
            <CopyRow label={t('mobileExtension.domain')} value={data.domain ?? ''} />
            <CopyRow label={t('mobileExtension.server')} value={data.server ?? ''} />
          </dl>
          <p className="m-0 text-sm leading-7 text-text-2">{t('mobileExtension.transport')}</p>
          {confirming ? (
            <InlineConfirm
              message={t('mobileExtension.resetConfirm')}
              confirmLabel={t('mobileExtension.resetYes')}
              cancelLabel={t('mobileExtension.resetNo')}
              pending={request.isPending}
              onConfirm={() => send(true)}
              onCancel={() => setConfirming(false)}
            />
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setConfirming(true)}>
                {t('mobileExtension.reset')}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
