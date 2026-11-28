import { type MouseEvent, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { copyText } from '@/lib/clipboard';
import { toast } from '@/lib/toast';
import { IconButton } from './IconButton';

interface CopyButtonProps {
  /** What is copied. */
  text: string;
  /** Its name (aria-label and tip), e.g. «کپی لینک پرداخت». */
  label: string;
  tone?: 'default' | 'muted' | 'inherit';
  iconSize?: number;
  className?: string;
}

/**
 * The one copy button: an icon that turns into a check for a moment once copied (no toast: the
 * check says it), or a toast when the browser refused. Works on plain-http addresses too, and in
 * dialogs (`copyText`'s fallback).
 */
export function CopyButton({
  text,
  label,
  tone = 'default',
  iconSize = 20,
  className = '',
}: CopyButtonProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const copy = (event: MouseEvent<HTMLButtonElement>) => {
    // Inside an open dialog, the fallback's hidden field goes in it, where it can take focus.
    copyText(
      text,
      event.currentTarget.closest<HTMLElement>('dialog, [role="dialog"]') ?? undefined,
    ).then(
      () => {
        window.clearTimeout(timer.current);
        setCopied(true);
        timer.current = window.setTimeout(() => setCopied(false), 1800);
      },
      () => toast.error(t('copy.failed')),
    );
  };
  return (
    <>
      <IconButton
        icon={copied ? 'check' : 'copy'}
        tone={copied ? 'done' : tone}
        aria-label={label}
        tip={copied ? t('copy.copied') : label}
        iconSize={iconSize}
        className={className}
        onClick={copy}
      />
      <span aria-live="polite" className="sr-only">
        {copied ? t('copy.copied') : ''}
      </span>
    </>
  );
}
