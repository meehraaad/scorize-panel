import { describe, expect, it } from 'vitest';
import { messageHref } from './api';

const TEXT =
  'سلام سارا عزیز 🌹🌷💐\nمی‌خواهیم 🇩🇪 👨‍👩‍👧 ❤️\nhttps://neshan.org/maps/places/sbvQBz2x491G?a=1&b=2';

describe('messageHref', () => {
  it('WhatsApp: the long link (wa.me loses emoji), the text encoded once and whole', () => {
    const href = messageHref('whatsapp', '09121234567', TEXT);
    expect(href.startsWith('https://api.whatsapp.com/send?phone=989121234567&text=')).toBe(true);
    expect(new URL(href).searchParams.get('text')).toBe(TEXT);
    expect(new URL(href).searchParams.get('phone')).toBe('989121234567');
  });

  it("Telegram: the customer's chat by number, with the draft encoded once", () => {
    const href = messageHref('telegram', '09121234567', TEXT);
    expect(href.startsWith('https://t.me/+989121234567?text=')).toBe(true);
    expect(new URL(href).searchParams.get('text')).toBe(TEXT);
    expect(messageHref('telegram', '09121234567')).toBe('https://t.me/+989121234567');
  });

  it('SMS: the text encoded once', () => {
    const href = messageHref('sms', '09121234567', TEXT);
    expect(decodeURIComponent(href.split('?body=')[1] ?? '')).toBe(TEXT);
  });
});
