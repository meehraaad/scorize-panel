import { ComingSoonPage } from '@/components/ComingSoonPage';
import { applicationsQuery } from '@/features/applications/api';
import { consultationQuery, consultationsQuery } from '@/features/consultations/api';
import { contractQuery, paymentQuery } from '@/features/contract/api';
import { eventQuery, packageQuery, servicesQuery } from '@/features/services/api';
import { turkeyQuery } from '@/features/turkey/api';
import { documentsQuery } from '@/features/documents/api';
import { overviewQuery } from '@/features/home/api';
import { writingQuery } from '@/features/writing/api';
import { queryClient } from '@/lib/api/queryClient';
import { accessQuery, useLockedNav } from '@/lib/applicant/access';
import { ON_SERVER } from '@/lib/applicant/onServer';
import { gatesQuery } from '@/lib/applicant/gates';
import { idParam, lazyPage, prefetchQueries } from '@/lib/router/lazyPage';
import { messagesQuery, ticketsQuery } from '@/lib/tickets/api';
import { findThread } from '@/features/tickets/config';
import type { PanelDefinition } from '../types';
import { applicantTickets } from './tickets';

/** Every account has this panel. Design: canvas V6/V7 "پنل متقاضی". */
export const applicantPanel: PanelDefinition = {
  id: 'applicant',
  path: '',
  name: 'panels.applicant.name',
  description: 'panels.applicant.description',
  icon: 'user',
  tone: 'neutral',
  navLabel: 'panels.applicant.nav.label',
  // Without an active contract, sections are a locked preview (canvas V7).
  useLockedNav,
  data: () => [accessQuery],
  navigation: [
    {
      id: 'home',
      to: '',
      label: 'panels.applicant.nav.home',
      tab: 'panels.applicant.tabs.home',
      icon: 'home',
    },
    {
      id: 'applications',
      to: 'applications',
      label: 'panels.applicant.nav.applications',
      tab: 'panels.applicant.tabs.applications',
      icon: 'graduation',
    },
    {
      id: 'documents',
      to: 'documents',
      label: 'panels.applicant.nav.documents',
      tab: 'panels.applicant.tabs.documents',
      icon: 'document',
    },
    {
      id: 'tickets',
      to: 'tickets',
      label: 'panels.applicant.nav.tickets',
      tab: 'panels.applicant.tabs.tickets',
      icon: 'chat',
    },
    { id: 'contract', to: 'contract', label: 'panels.applicant.nav.contract', icon: 'card' },
    { id: 'services', to: 'services', label: 'panels.applicant.nav.services', icon: 'grid' },
  ],
  routes: [
    {
      // Terms, missing details, supervisor surveys or a closed panel come before any page
      // (canvas V6 section 8).
      ...lazyPage(
        () => import('@/features/gates/GatesLayout'),
        ['gates'],
        () => [gatesQuery],
      ),
      children: [
        {
          index: true,
          ...lazyPage(
            () => import('@/features/home/HomePage'),
            ['home', 'gates'],
            () => [overviewQuery],
          ),
        },
        {
          path: 'applications',
          ...lazyPage(
            () => import('@/features/applications/ApplicationsPage'),
            ['applications'],
            () => [applicationsQuery],
          ),
        },
        {
          path: 'documents',
          ...lazyPage(
            () => import('@/features/documents/DocumentsPage'),
            ['documents'],
            () => [documentsQuery],
          ),
        },
        // Writing information forms. Design: canvas V6 sections 4 (SOP) and 5 (CV).
        {
          path: 'documents/sop',
          ...lazyPage(
            () => import('@/features/writing/SopFormPage'),
            ['writing'],
            () => [writingQuery('sop')],
          ),
        },
        {
          path: 'documents/cv',
          ...lazyPage(
            () => import('@/features/writing/CvFormPage'),
            ['writing'],
            () => [writingQuery('cv')],
          ),
        },
        // Design: canvas V8 "فرم‌های نگارش دیگر" (AppRecForm, AppProfForm).
        {
          path: 'documents/recommendation',
          ...lazyPage(
            () => import('@/features/writing/RecommendationFormPage'),
            ['writing'],
            () => [writingQuery('recommendation')],
          ),
        },
        {
          path: 'documents/pl',
          ...lazyPage(
            () => import('@/features/writing/PlFormPage'),
            ['writing'],
            () => [writingQuery('pl')],
          ),
        },
        // PS and DS: the SOP form with their own questions (canvas V8 note), Django's
        // PersonalStatement and DiversityStatement.
        {
          path: 'documents/ps',
          ...lazyPage(
            () => import('@/features/writing/PsFormPage'),
            ['writing'],
            () => [writingQuery('ps')],
          ),
        },
        {
          path: 'documents/ds',
          ...lazyPage(
            () => import('@/features/writing/DsFormPage'),
            ['writing'],
            () => [writingQuery('ds')],
          ),
        },
        // Any other writing order: no form in the panel.
        {
          path: 'documents/:writing',
          element: <ComingSoonPage title="panels.applicant.nav.documents" />,
        },
        // Supervisor and writing tickets. Design: canvas V6 "تیکت‌ها" / "تیکت نگارش" (AppTickets).
        {
          path: 'tickets/*',
          // The thread comes from the list: its messages start as soon as the list arrives.
          loader: ({ params }) => {
            queryClient
              .query(ticketsQuery(applicantTickets))
              .then((data) => {
                const thread = data && findThread(data.threads, params['*'] ?? '');
                if (thread) prefetchQueries([messagesQuery(applicantTickets, thread.id)]);
              })
              .catch(() => undefined);
            return null;
          },
          ...lazyPage(() => import('./TicketsPage'), ['tickets']),
        },
        // Design: canvas V6 sections 7 (contract) and 11 (payment details).
        {
          path: 'contract',
          ...lazyPage(
            () => import('@/features/contract/ContractPage'),
            ['contract'],
            () => [contractQuery],
          ),
        },
        {
          // An invoice: an instalment, or a purchase from "other services".
          path: 'payments/:id',
          ...lazyPage(
            () => import('@/features/contract/PaymentPage'),
            ['contract'],
            ({ params }) => {
              const id = idParam(params.id);
              return [id !== null && paymentQuery(id)];
            },
          ),
        },
        // Design: canvas V6 section 9. Open with or without a contract.
        {
          path: 'services',
          ...lazyPage(
            () => import('@/features/services/ServicesPage'),
            ['services'],
            () => [servicesQuery],
          ),
        },
        // A bought package, an event. Design: canvas V6 section 13 (reached from services).
        {
          path: 'services/packages/:id',
          ...lazyPage(
            () => import('@/features/services/PackagePage'),
            ['services'],
            ({ params }) => {
              const id = idParam(params.id);
              return [id !== null && packageQuery(id)];
            },
          ),
        },
        {
          path: 'services/events/:id',
          ...lazyPage(
            () => import('@/features/services/EventPage'),
            ['services'],
            ({ params }) => {
              const id = idParam(params.id);
              return [id !== null && eventQuery(id)];
            },
          ),
        },
        // Booked consultations and one session. Design: canvas V6 section 15 (reached from services).
        {
          path: 'consultations',
          ...lazyPage(
            () => import('@/features/consultations/ConsultationsPage'),
            ['consultations'],
            () => [consultationsQuery],
          ),
        },
        {
          path: 'consultations/:id',
          ...lazyPage(
            () => import('@/features/consultations/ConsultationPage'),
            ['consultations'],
            ({ params }) => {
              const id = idParam(params.id);
              return [id !== null && consultationQuery(id)];
            },
          ),
        },
        // The free Turkey application (no nav item: the guest home links to it). Canvas V7 section 3.
        ON_SERVER.turkey
          ? {
              path: 'turkey',
              ...lazyPage(
                () => import('@/features/turkey/TurkeyPage'),
                ['turkey'],
                () => [turkeyQuery],
              ),
            }
          : { path: 'turkey', element: <ComingSoonPage title="panels.applicant.nav.home" /> },
      ],
    },
  ],
};
