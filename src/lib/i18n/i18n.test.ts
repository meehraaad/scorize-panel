import { describe, expect, it } from 'vitest';
import i18n from './index';

describe('i18n', () => {
  it('switches direction and lang on <html> with the language', async () => {
    await i18n.changeLanguage('en');
    expect(document.documentElement.dir).toBe('ltr');
    expect(document.documentElement.lang).toBe('en');
    expect(i18n.t('panels.applicant.nav.home')).toBe('My case');

    await i18n.changeLanguage('fa');
    expect(document.documentElement.dir).toBe('rtl');
    expect(i18n.t('panels.applicant.nav.home')).toBe('پرونده‌ی من');
  });

  it('tells Django which language to use', async () => {
    await i18n.changeLanguage('en');
    expect(document.cookie).toContain('django_language=en');
    await i18n.changeLanguage('fa');
  });
});
