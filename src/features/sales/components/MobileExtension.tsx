import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { InlineConfirm } from '@/components/ui/InlineConfirm';
import { Notice } from '@/components/ui/Notice';
import { mobileExtensionQuery, useRequestMobileExtension } from '@/lib/sales/phoneCalls';
import { toast } from '@/lib/toast';

function CopyRow({
  label,
  value,
  shown = true,
}: {
  label: string;
  value: string;
  shown?: boolean;
}) {
  const { t } = useTranslation('sales');
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-sm text-text-2">{label}</dt>
      <dd className="m-0 flex items-center gap-2">
        <code dir="ltr" className="min-w-0 flex-1 truncate rounded-xl bg-tint px-3 py-2 text-base">
          {shown ? value : '••••••••••••'}
        </code>
        <IconButton
          icon={copied ? 'check' : 'document'}
          tone="muted"
          aria-label={t('mobileExtension.copy', { label })}
          onClick={() => {
            void navigator.clipboard
              .writeText(value)
              .then(() => setCopied(true))
              .catch(() => setCopied(false));
          }}
        />
      </dd>
    </div>
  );
}

/** Settings: the seller's own PortSIP login, made on the office PBX when they ask for it. */
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
          <p className="m-0 text-[15px] leading-7 text-text-2">{t('mobileExtension.setup')}</p>
          <dl className="m-0 flex flex-col gap-3">
            <CopyRow label={t('mobileExtension.extension')} value={data.extension} />
            <CopyRow label={t('mobileExtension.password')} value={data.password} shown={revealed} />
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
              <Button variant="outline" onClick={() => setRevealed((value) => !value)}>
                {revealed ? t('mobileExtension.hide') : t('mobileExtension.show')}
              </Button>
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
