import { describe, expect, it } from 'vitest';
import { pagesOf } from './page';

describe('pagesOf', () => {
  it('counts whole pages, at least one', () => {
    expect(pagesOf(undefined)).toBe(1);
    expect(pagesOf({ count: 0, page_size: 10 })).toBe(1);
    expect(pagesOf({ count: 10, page_size: 10 })).toBe(1);
    expect(pagesOf({ count: 11, page_size: 10 })).toBe(2);
  });
});
