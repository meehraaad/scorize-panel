import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { buttonClass } from '@/components/ui/buttonStyles';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { copyText } from '@/lib/clipboard';
import { toast } from '@/lib/toast';

/**
 * The tablet form's link to send a customer before they come in. It names no one: it opens with
 * whoever is logged in, so it can't show or change another customer's details.
 * `iconOnly`: the customer head's quick button, which shows a check for a moment once copied.
 */
export function CopyTabletLink({ url, iconOnly = false }: { url: string; iconOnly?: boolean }) {
  const { t } = useTranslation('sales');
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  if (!url) return null;
  const copy = () => {
    copyText(url).then(
      () => {
        toast.success(t('info.tablet.copied'));
        window.clearTimeout(timer.current);
        setCopied(true);
        timer.current = window.setTimeout(() => setCopied(false), 1800);
      },
      () => toast.error(t('info.tablet.copyFailed')),
    );
  };
  if (iconOnly)
    return (
      <IconButton
        icon={copied ? 'check' : 'tablet'}
        tone={copied ? 'done' : 'default'}
        aria-label={t('info.tablet.copy')}
        tip={copied ? t('info.tablet.copiedShort') : t('info.tablet.copy')}
        onClick={copy}
      />
    );
  return (
    <button
      type="button"
      onClick={copy}
      className={buttonClass('outline', 'h-10 px-4 text-[13px]')}
    >
      <Icon name="paperclip" size={15} />
      {t('info.tablet.copy')}
    </button>
  );
}
