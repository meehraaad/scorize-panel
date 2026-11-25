import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Chip } from '@/components/ui/Chip';
import { Dialog } from '@/components/ui/Dialog';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { copyText } from '@/lib/clipboard';
import { useDisplayName } from '@/lib/i18n/useDisplayName';
import { toast } from '@/lib/toast';
import { messageHref } from '@/lib/sales/messageLink';
import type { CustomerData } from '../api';

const rowClass =
  'flex min-w-0 flex-1 items-start gap-3 rounded-2xl px-4 py-3.5 text-start shadow-[inset_0_0_0_1px_var(--line-2)]';

export type PickerChannel = 'whatsapp' | 'telegram';

/**
 * WhatsApp or Telegram from the customer's page: pick a ready message (the seller's own first,
 * then management's, filled in for this customer) or none. Each is a link, so the app opens on the
 * tap with the text typed in, and the dialog closes. Each also has its own copy button: the way
 * out when the app can't find the customer or doesn't take the text, and the only way when the
 * customer has no mobile number (then nothing opens an app).
 */
export function WhatsAppPicker({
  customer,
  onClose,
  channel = 'whatsapp',
}: {
  customer: CustomerData;
  onClose: () => void;
  channel?: PickerChannel;
}) {
  const { t } = useTranslation('sales');
  const named = useDisplayName();
  const list = useRef<HTMLUListElement>(null);
  const key = channel === 'telegram' ? 'telegramPicker' : 'whatsAppPicker';
  const chat = messageHref(channel, customer.phone);

  const copy = (text: string) =>
    // Inside the dialog: the old-way copy needs its textarea where focus can go.
    copyText(text, list.current ?? document.body)
      .then(() => toast.success(t('whatsAppPicker.copied')))
      .catch(() => toast.error(t('whatsAppPicker.copyFailed')));

  return (
    <Dialog
      open
      onClose={onClose}
      title={t(`${key}.title`)}
      subtitle={named(customer.name)}
      closeLabel={t('whatsAppPicker.close')}
    >
      <div className="flex flex-col gap-3">
        <p className="m-0 text-[13px] leading-6 text-text-2">
          {chat ? t(`${key}.note`) : t('whatsAppPicker.noPhone')}
        </p>
        <ul ref={list} className="m-0 flex list-none flex-col gap-2 p-0">
          {customer.templates.map((template) => {
            const href = messageHref(channel, customer.phone, template.text);
            const body = (
              <>
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="flex flex-wrap items-center gap-2 text-[15px] font-semibold">
                    {template.title}
                    {template.own && (
                      <Chip tone="info" small>
                        {t('whatsAppPicker.own')}
                      </Chip>
                    )}
                  </span>
                  <span className="line-clamp-3 text-[13px] leading-6 whitespace-pre-line text-text-2">
                    {template.text}
                  </span>
                </span>
                {href && <Icon name="send" size={18} className="mt-1 flex-none text-text-3" />}
              </>
            );
            return (
              <li key={template.id} className="flex items-start gap-1">
                {href ? (
                  <a
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    onClick={onClose}
                    className={`${rowClass} hover:bg-canvas`}
                  >
                    {body}
                  </a>
                ) : (
                  <div className={rowClass}>{body}</div>
                )}
                <IconButton
                  icon="document"
                  aria-label={t('whatsAppPicker.copy', { title: template.title })}
                  onClick={() => void copy(template.text)}
                />
              </li>
            );
          })}
          {chat && (
            <li>
              <a
                href={chat}
                target="_blank"
                rel="noreferrer"
                onClick={onClose}
                className={`${rowClass} w-full hover:bg-canvas`}
              >
                <span className="flex-1 text-[15px] font-medium text-text-2">
                  {t('whatsAppPicker.blank')}
                </span>
                <Icon name="send" size={18} className="mt-1 flex-none text-text-3" />
              </a>
            </li>
          )}
        </ul>
        <Link
          to="/settings"
          className="inline-flex min-h-11 items-center gap-2 self-start text-sm font-medium text-primary-text"
        >
          <Icon name="plus" size={16} />
          {t('whatsAppPicker.make')}
        </Link>
      </div>
    </Dialog>
  );
}
