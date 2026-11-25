import { normalizePhone } from '@/lib/text';
import type { MessageChannel } from './api';

// Its own module, out of `./api` (loaded on every page): only the sales screens need it.
/**
 * A link that opens the messaging app on the customer's chat with `text` ready to send; null when
 * `phone` isn't a mobile number (empty, a landline, a typo), so no caller can open an app on a
 * chat that doesn't exist ("t.me/+98"). The caller then offers the text to copy instead.
 */
export function messageHref(channel: MessageChannel, phone: string, text = ''): string | null {
  const mobile = normalizePhone(phone);
  if (!mobile) return null;
  const international = `98${mobile.slice(1)}`;
  const body = encodeURIComponent(text);
  // The long form, not wa.me: wa.me redirects here and the redirect turns emoji (🌹) into "?".
  if (channel === 'whatsapp')
    return `https://api.whatsapp.com/send?phone=${international}&text=${body}`;
  // Telegram's phone link takes a draft too (core.telegram.org/api/links, phone number links).
  if (channel === 'telegram') return `https://t.me/+${international}${text ? `?text=${body}` : ''}`;
  return `sms:${mobile}${text ? `?body=${body}` : ''}`;
}
