import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Chip } from '@/components/ui/Chip';
import { Dialog } from '@/components/ui/Dialog';
import { Icon } from '@/components/ui/Icon';
import { copyText } from '@/lib/clipboard';
import { useDisplayName } from '@/lib/i18n/useDisplayName';
import { toast } from '@/lib/toast';
import { messageHref } from '@/lib/sales/api';
import type { CustomerData } from '../api';

const rowClass =
  'flex w-full items-start gap-3 rounded-2xl px-4 py-3.5 text-start shadow-[inset_0_0_0_1px_var(--line-2)] hover:bg-canvas';

export type PickerChannel = 'whatsapp' | 'telegram';

/**
 * A message from the customer's page: pick a ready message (the seller's own first, then
 * management's, filled in for this customer) or none. Each is a link, so the app opens on the tap.
 * WhatsApp gets the text typed in. A Telegram link can't carry a text to a phone number, so the
 * text is copied on the same tap for the seller to paste; if copying fails the dialog stays open
 * with the whole text to copy by hand.
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
  const [failed, setFailed] = useState<{ id: number; text: string } | null>(null);
  const telegram = channel === 'telegram';
  const key = telegram ? 'telegramPicker' : 'whatsAppPicker';

  const pick = (template: { id: number; text: string }) => {
    if (!telegram) {
      onClose();
      return;
    }
    // Started inside the tap (the browser allows a copy only then); the link opens Telegram.
    copyText(template.text, list.current ?? document.body)
      .then(() => {
        toast.success(t('telegramPicker.copied'));
        onClose();
      })
      .catch(() => setFailed(template));
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={t(`${key}.title`)}
      subtitle={named(customer.name)}
      closeLabel={t('whatsAppPicker.close')}
    >
      <div className="flex flex-col gap-3">
        {telegram && (
          <p className="m-0 text-[13px] leading-6 text-text-2">{t('telegramPicker.note')}</p>
        )}
        {failed && (
          <div className="flex flex-col gap-2" role="alert">
            <p className="m-0 text-[13px] leading-6 font-medium text-danger">
              {t('telegramPicker.copyFailed')}
            </p>
            <textarea
              readOnly
              value={failed.text}
              rows={6}
              aria-label={t('telegramPicker.text')}
              onFocus={(event) => event.currentTarget.select()}
              className="w-full rounded-xl p-3 text-sm leading-6 shadow-[inset_0_0_0_1px_var(--line-2)]"
            />
          </div>
        )}
        <ul ref={list} className="m-0 flex list-none flex-col gap-2 p-0">
          {customer.templates.map((template) => (
            <li key={template.id}>
              <a
                href={messageHref(channel, customer.phone, template.text)}
                target="_blank"
                rel="noreferrer"
                onClick={() => pick(template)}
                className={rowClass}
              >
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
                <Icon name="send" size={18} className="mt-1 flex-none text-text-3" />
              </a>
            </li>
          ))}
          <li>
            <a
              href={messageHref(channel, customer.phone)}
              target="_blank"
              rel="noreferrer"
              onClick={onClose}
              className={rowClass}
            >
              <span className="flex-1 text-[15px] font-medium text-text-2">
                {t('whatsAppPicker.blank')}
              </span>
              <Icon name="send" size={18} className="mt-1 flex-none text-text-3" />
            </a>
          </li>
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
