import 'i18next';
import type applications from '@/locales/fa/applications.json';
import type auth from '@/locales/fa/auth.json';
import type common from '@/locales/fa/common.json';
import type contract from '@/locales/fa/contract.json';
import type documents from '@/locales/fa/documents.json';
import type home from '@/locales/fa/home.json';
import type tickets from '@/locales/fa/tickets.json';
import type turkey from '@/locales/fa/turkey.json';
import type writing from '@/locales/fa/writing.json';

// Persian is the source dictionary: t('...') keys are type-checked against it,
// so a typo or a key missing from fa/*.json is a compile error.
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: {
      common: typeof common;
      auth: typeof auth;
      home: typeof home;
      applications: typeof applications;
      documents: typeof documents;
      writing: typeof writing;
      tickets: typeof tickets;
      contract: typeof contract;
      turkey: typeof turkey;
    };
  }
}
