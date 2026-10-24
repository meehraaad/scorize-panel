import { describe, expect, it } from 'vitest';
import { safeHref } from './url';

describe('safeHref', () => {
  it.each([
    '/media/files/cv.pdf',
    'https://pay.example.ir/start?id=1',
    'http://example.com/a',
    'files/cv.pdf',
  ])('keeps %s', (url) => {
    expect(safeHref(url)).toBe(url);
  });

  it.each([
    'javascript:alert(1)',
    ' JavaScript:alert(1)',
    '\tjava\nscript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)',
    '',
    null,
    undefined,
  ])('drops %j', (url) => {
    expect(safeHref(url)).toBeUndefined();
  });
});
