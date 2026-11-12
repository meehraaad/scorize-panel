import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Chip } from '@/components/ui/Chip';
import { Dialog } from '@/components/ui/Dialog';
import { Icon } from '@/components/ui/Icon';
import { useDisplayName } from '@/lib/i18n/useDisplayName';
import { messageHref } from '@/lib/sales/api';
import type { CustomerData } from '../api';

const rowClass =
  'flex w-full items-start gap-3 rounded-2xl px-4 py-3.5 text-start shadow-[inset_0_0_0_1px_var(--line-2)] hover:bg-canvas';

/**
 * WhatsApp from the customer's page: pick a ready message (the seller's own first, then
 * management's, filled in for this customer) or none. Each is a link, so WhatsApp opens on the tap
 * with the text typed in, and the dialog closes.
 */
export function WhatsAppPicker({
  customer,
  onClose,
}: {
  customer: CustomerData;
  onClose: () => void;
}) {
  const { t } = useTranslation('sales');
  const named = useDisplayName();

  return (
    <Dialog
      open
      onClose={onClose}
      title={t('whatsAppPicker.title')}
      subtitle={named(customer.name)}
      closeLabel={t('whatsAppPicker.close')}
    >
      <div className="flex flex-col gap-3">
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {customer.templates.map((template) => (
            <li key={template.id}>
              <a
                href={messageHref('whatsapp', customer.phone, template.text)}
                target="_blank"
                rel="noreferrer"
                onClick={onClose}
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
              href={messageHref('whatsapp', customer.phone)}
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
