import { describe, expect, it } from 'vitest';
import { messageHref } from './messageLink';

const TEXT =
  'سلام سارا عزیز 🌹🌷💐\nمی‌خواهیم 🇩🇪 👨‍👩‍👧 ❤️\nhttps://neshan.org/maps/places/sbvQBz2x491G?a=1&b=2';

const url = (href: string | null) => new URL(href ?? 'about:blank');

describe('messageHref', () => {
  it('WhatsApp: the long link (wa.me loses emoji), the text encoded once and whole', () => {
    const href = messageHref('whatsapp', '09121234567', TEXT);
    expect(href?.startsWith('https://api.whatsapp.com/send?phone=989121234567&text=')).toBe(true);
    expect(url(href).searchParams.get('text')).toBe(TEXT);
  });

  it("Telegram: the customer's chat by number, with the draft encoded once", () => {
    const href = messageHref('telegram', '09121234567', TEXT);
    expect(href?.startsWith('https://t.me/+989121234567?text=')).toBe(true);
    expect(url(href).searchParams.get('text')).toBe(TEXT);
    expect(messageHref('telegram', '09121234567')).toBe('https://t.me/+989121234567');
  });

  it('SMS: the text encoded once', () => {
    const href = messageHref('sms', '09121234567', TEXT) ?? '';
    expect(href.startsWith('sms:09121234567?body=')).toBe(true);
    expect(decodeURIComponent(href.split('?body=')[1] ?? '')).toBe(TEXT);
  });

  it('accepts the ways a mobile number is written', () => {
    for (const phone of ['+98 912 123 4567', '00989121234567', '989121234567', '۰۹۱۲۱۲۳۴۵۶۷'])
      expect(messageHref('telegram', phone)).toBe('https://t.me/+989121234567');
  });

  it('opens no chat without a mobile number (no "t.me/+98", no "phone=98")', () => {
    for (const phone of ['', '   ', '0912', '02191018457', 'unknown'])
      for (const channel of ['whatsapp', 'telegram', 'sms'] as const)
        expect(messageHref(channel, phone, TEXT)).toBeNull();
  });
});
