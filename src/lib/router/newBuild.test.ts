import { describe, expect, it } from 'vitest';
import { entryOf } from './newBuild';

describe('entryOf', () => {
  it("finds the build's entry script", () => {
    const html =
      '<script>boot()</script><script type="module" crossorigin src="/panel/assets/index-AbC123.js"></script>';
    expect(entryOf(html, 'https://panel.example/sales/')).toBe(
      'https://panel.example/panel/assets/index-AbC123.js',
    );
  });

  it('answers null without one', () => {
    expect(entryOf('<p>maintenance</p>', 'https://panel.example/')).toBeNull();
  });
});
