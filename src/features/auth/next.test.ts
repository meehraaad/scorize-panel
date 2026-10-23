import { describe, expect, it } from 'vitest';
import { safeNextPath, toRouterPath } from './next';

const BASE = '/panel/';

describe('safeNextPath', () => {
  it.each([
    [null, '/panel/'],
    ['/panel/tickets?x=1', '/panel/tickets?x=1'],
    ['/shop/item', '/shop/item'],
    ['https://evil.example/', '/panel/'],
    ['//evil.example/', '/panel/'],
    ['/\\evil.example', '/panel/'],
    ['javascript:alert(1)', '/panel/'],
    ['/panel/login?next=/panel/', '/panel/'],
  ])('%s → %s', (input, expected) => {
    expect(safeNextPath(input, BASE)).toBe(expected);
  });
});

describe('toRouterPath', () => {
  it('maps panel URLs to router paths and leaves the rest of the site alone', () => {
    expect(toRouterPath('/panel/', BASE)).toBe('/');
    expect(toRouterPath('/panel', BASE)).toBe('/');
    expect(toRouterPath('/panel/tickets?x=1', BASE)).toBe('/tickets?x=1');
    expect(toRouterPath('/shop/item', BASE)).toBeNull();
  });
});
