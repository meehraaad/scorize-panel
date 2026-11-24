import { useTranslation } from 'react-i18next';
import { ContactLogButton } from '@/components/sales/ContactLogButton';
import { buttonClass } from '@/components/ui/buttonStyles';
import { Icon } from '@/components/ui/Icon';
import { IconLink } from '@/components/ui/IconButton';
import { CHANNEL_ICON, MESSAGE_CHANNELS } from '@/lib/sales/api';
import { messageHref } from '@/lib/sales/messageLink';

/**
 * "Call" opens the persistent contact form (the dialer button is there, so every
 * call gets recorded), plus the messaging apps. `onHero`: light buttons on the dark card.
 */
export function ContactButtons({
  customer,
  name,
  phone,
  messages = true,
  onHero = false,
}: {
  customer: number;
  name: string;
  phone: string;
  /** Also the WhatsApp / Telegram / SMS buttons. */
  messages?: boolean;
  onHero?: boolean;
}) {
  const { t } = useTranslation('sales');
  return (
    <div className="flex flex-none flex-wrap items-center gap-1">
      <ContactLogButton
        customer={customer}
        name={name}
        start={{ channel: 'call' }}
        phone={phone}
        aria-label={t('callName', { name })}
        className={
          onHero
            ? 'inline-flex h-11 items-center gap-2 rounded-full bg-on-hero px-5 text-[15px] font-semibold text-hero'
            : buttonClass('outline', 'h-11 px-4 text-sm')
        }
      >
        <Icon name="phone" size={18} />
        {t('call')}
      </ContactLogButton>
      {messages &&
        MESSAGE_CHANNELS.map((channel) => {
          // No mobile number: no chat to open.
          const href = messageHref(channel, phone);
          return (
            href && (
              <IconLink
                key={channel}
                href={href}
                target="_blank"
                rel="noreferrer"
                icon={CHANNEL_ICON[channel]}
                aria-label={t('messageTo', { channel: t(`channel.${channel}`), name })}
                tone={onHero ? 'inherit' : 'default'}
                className={onHero ? 'text-on-hero hover:bg-hero-raised' : ''}
              />
            )
          );
        })}
    </div>
  );
}
