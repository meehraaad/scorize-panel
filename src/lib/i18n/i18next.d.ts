import 'i18next';
import type auth from '@/locales/fa/auth.json';
import type common from '@/locales/fa/common.json';

// Persian is the source dictionary: t('...') keys are type-checked against it,
// so a typo or a key missing from fa/*.json is a compile error.
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: { common: typeof common; auth: typeof auth };
  }
}
