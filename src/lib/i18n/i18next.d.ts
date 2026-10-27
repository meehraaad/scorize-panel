import 'i18next';
import type account from '@/locales/fa/account.json';
import type activities from '@/locales/fa/activities.json';
import type applications from '@/locales/fa/applications.json';
import type auth from '@/locales/fa/auth.json';
import type common from '@/locales/fa/common.json';
import type booking from '@/locales/fa/booking.json';
import type consultations from '@/locales/fa/consultations.json';
import type contract from '@/locales/fa/contract.json';
import type documents from '@/locales/fa/documents.json';
import type estimate from '@/locales/fa/estimate.json';
import type journey from '@/locales/fa/journey.json';
import type gates from '@/locales/fa/gates.json';
import type home from '@/locales/fa/home.json';
import type services from '@/locales/fa/services.json';
import type supervisor from '@/locales/fa/supervisor.json';
import type sales from '@/locales/fa/sales.json';
import type tasks from '@/locales/fa/tasks.json';
import type tickets from '@/locales/fa/tickets.json';
import type turkey from '@/locales/fa/turkey.json';
import type writer from '@/locales/fa/writer.json';
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
      estimate: typeof estimate;
      journey: typeof journey;
      services: typeof services;
      consultations: typeof consultations;
      booking: typeof booking;
      account: typeof account;
      activities: typeof activities;
      gates: typeof gates;
      sales: typeof sales;
      tasks: typeof tasks;
      supervisor: typeof supervisor;
      writer: typeof writer;
    };
  }
}
