import { describe, expect, it } from 'vitest';
import { formatPhone } from './site';

describe('formatPhone', () => {
  it('formats landlines and mobiles, leaves anything else alone', () => {
    expect(formatPhone('02191018457')).toBe('021-91018457');
    expect(formatPhone('09123456789')).toBe('0912 345 6789');
    expect(formatPhone('+44 20 7946 0958')).toBe('+44 20 7946 0958');
  });
});
