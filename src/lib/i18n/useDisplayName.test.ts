import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/lib/i18n';
import { useDisplayName } from './useDisplayName';

describe('useDisplayName', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('fa');
  });

  it('keeps a name and writes «بدون نام» for none, so a customer link always has text', () => {
    const { result } = renderHook(() => useDisplayName());
    expect(result.current('سارا محمدی')).toBe('سارا محمدی');
    expect(result.current('')).toBe('بدون نام');
    expect(result.current('  ')).toBe('بدون نام');
    expect(result.current(null)).toBe('بدون نام');
  });
});
