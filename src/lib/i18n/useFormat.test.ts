import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/lib/i18n';
import { useFormat } from './useFormat';

describe('price', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
  });

  const price = (amount: number, currency: string | null) => {
    const { result } = renderHook(() => useFormat());
    return result.current.price(amount, currency, (value) => `${value} toman`);
  };

  it('writes toman with the page text, with or without a currency code', () => {
    expect(price(1_500_000, 'IRT')).toBe('1,500,000 toman');
    expect(price(1_500_000, null)).toBe('1,500,000 toman');
  });

  it('writes other currencies as Intl does, not as toman', () => {
    expect(price(4200, 'EUR')).toBe('€4,200');
  });
});
