import { describe, expect, it } from 'vitest';
import { isIphoneSafari } from './install';

const iphone =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko)';

describe('isIphoneSafari', () => {
  it('recognizes a Safari tab on iPhone', () => {
    expect(isIphoneSafari(iphone + ' Version/18.6 Mobile/15E148 Safari/604.1')).toBe(true);
  });

  it.each([
    'CriOS/139.0.0.0 Mobile/15E148 Safari/604.1',
    'FxiOS/139.0 Mobile/15E148 Safari/605.1.15',
    'EdgiOS/139.0.0.0 Version/18.6 Mobile/15E148 Safari/604.1',
    'Mobile/15E148',
    'Version/18.6 Mobile/15E148 Safari/604.1 Instagram 392.0',
  ])('uses the handoff for %s', (product) => {
    expect(isIphoneSafari(iphone + ' ' + product)).toBe(false);
  });
});
