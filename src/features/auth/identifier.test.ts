import { describe, expect, it } from 'vitest';
import { normalizePhone, parseIdentifier, toLatinDigits } from './identifier';

describe('identifier', () => {
  it('converts Persian and Arabic digits', () => {
    expect(toLatinDigits('۰۹۱۲٣٤٥')).toBe('0912345');
  });

  it.each([
    ['09123456789', '09123456789'],
    ['۰۹۱۲۳۴۵۶۷۸۹', '09123456789'],
    ['9123456789', '09123456789'],
    ['+98 912 345 6789', '09123456789'],
    ['0098-912-345-6789', '09123456789'],
    ['989123456789', '09123456789'],
  ])('normalizes phone %s', (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it.each(['0912345678', '08123456789', '0912345678901', 'abc'])('rejects phone %s', (input) => {
    expect(normalizePhone(input)).toBeNull();
  });

  it('tells phone and email apart', () => {
    expect(parseIdentifier(' sara@example.com ')).toEqual({
      type: 'email',
      value: 'sara@example.com',
    });
    expect(parseIdentifier('۰۹۱۲۳۴۵۶۷۸۹')).toEqual({ type: 'phone', value: '09123456789' });
    expect(parseIdentifier('sara@')).toBeNull();
  });
});
