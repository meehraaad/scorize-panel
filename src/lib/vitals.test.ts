import { describe, expect, it } from 'vitest';
import { pagePattern } from './vitals';

describe('speed reports', () => {
  it('name pages by pattern, never with record ids', () => {
    expect(pagePattern('/panel/sales/customers/105/payments')).toBe(
      '/panel/sales/customers/:id/payments',
    );
    expect(pagePattern('/panel/payments/501')).toBe('/panel/payments/:id');
    expect(pagePattern('/panel/documents/sop')).toBe('/panel/documents/sop');
  });
});
