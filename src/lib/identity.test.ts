import { describe, expect, it } from 'vitest';
import { isLatinName, isPersianText, normalizeIban, normalizeNationalCode } from './identity';

describe('national code', () => {
  it('accepts a code with the right check digit, typed with any digits', () => {
    expect(normalizeNationalCode('0499370899')).toBe('0499370899');
    expect(normalizeNationalCode('۰۴۹۹۳۷۰۸۹۹')).toBe('0499370899');
    expect(normalizeNationalCode('049-937-0899')).toBe('0499370899');
  });

  it('refuses a wrong check digit, a short code and ten equal digits', () => {
    expect(normalizeNationalCode('0499370898')).toBeNull();
    expect(normalizeNationalCode('049937089')).toBeNull();
    expect(normalizeNationalCode('1111111111')).toBeNull();
  });
});

describe('IBAN', () => {
  it('accepts an Iranian IBAN with or without IR, spaces and Persian digits', () => {
    const iban = 'IR820540102680020817909002';
    expect(normalizeIban(iban)).toBe(iban);
    expect(normalizeIban('820540102680020817909002')).toBe(iban);
    expect(normalizeIban('ir82 0540 1026 8002 0817 9090 02')).toBe(iban);
    expect(normalizeIban('IR۸۲۰۵۴۰۱۰۲۶۸۰۰۲۰۸۱۷۹۰۹۰۰۲')).toBe(iban);
  });

  it('refuses a wrong check and the wrong length', () => {
    expect(normalizeIban('IR820540102680020817909003')).toBeNull();
    expect(normalizeIban('IR8205401026800208179090')).toBeNull();
  });
});

describe('names', () => {
  it('tells Persian from Latin', () => {
    expect(isPersianText('علی‌رضا')).toBe(true);
    expect(isPersianText('Ali')).toBe(false);
    expect(isLatinName("O'Neil")).toBe(true);
    expect(isLatinName('علی')).toBe(false);
  });
});
