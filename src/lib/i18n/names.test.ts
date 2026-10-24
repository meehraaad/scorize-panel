import { afterEach, describe, expect, it } from 'vitest';
import i18n from './index';
import { joinNames, localName } from './names';

describe('names', () => {
  afterEach(async () => {
    await i18n.changeLanguage('fa');
  });

  it('joins and names in Persian', () => {
    expect(joinNames(['IELTS 7', 'GRE 320'])).toBe('IELTS 7، GRE 320');
    expect(localName('Canada', 'کانادا')).toBe('کانادا');
    expect(localName('Canada', null)).toBe('Canada');
  });

  it('joins and names in English', async () => {
    await i18n.changeLanguage('en');
    expect(joinNames(['IELTS 7', 'GRE 320'])).toBe('IELTS 7, GRE 320');
    expect(localName('Canada', 'کانادا')).toBe('Canada');
    expect(localName('', 'کانادا')).toBe('کانادا');
  });
});
