import { ComingSoonPage } from '@/components/ComingSoonPage';
import { applicationsQuery } from '@/features/applications/api';
import { consultationQuery, consultationsQuery } from '@/features/consultations/api';
import { contractQuery, paymentQuery } from '@/features/contract/api';
import { eventQuery, packageQuery, servicesQuery } from '@/features/services/api';
import { turkeyQuery } from '@/features/turkey/api';
import { documentsQuery } from '@/features/documents/api';
import { overviewQuery } from '@/features/home/api';
import { writingQuery } from '@/features/writing/api';
import { accessQuery, useLockedNav } from '@/lib/applicant/access';
import { ON_SERVER } from '@/lib/applicant/onServer';
import { gatesQuery } from '@/lib/applicant/gates';
import { idParam, lazyPage } from '@/lib/router/lazyPage';
import { prefetchTickets } from '@/features/tickets/config';
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
      ...lazyPage(() => import('@/features/gates/GatesLayout'), ['gates'], {
        data: () => [gatesQuery],
      }),
      children: [
        {
          index: true,
          ...lazyPage(() => import('@/features/home/HomePage'), ['home', 'gates'], {
            data: () => [overviewQuery],
            skeleton: 'dashboard',
          }),
        },
        {
          path: 'applications',
          ...lazyPage(() => import('@/features/applications/ApplicationsPage'), ['applications'], {
            data: () => [applicationsQuery],
            skeleton: 'list',
          }),
        },
        {
          path: 'documents',
          ...lazyPage(() => import('@/features/documents/DocumentsPage'), ['documents'], {
            data: () => [documentsQuery],
            skeleton: 'dashboard',
          }),
        },
        // Writing information forms. Design: canvas V6 sections 4 (SOP) and 5 (CV).
        {
          path: 'documents/sop',
          ...lazyPage(() => import('@/features/writing/SopFormPage'), ['writing'], {
            data: () => [writingQuery('sop')],
            skeleton: 'form',
          }),
        },
        {
          path: 'documents/cv',
          ...lazyPage(() => import('@/features/writing/CvFormPage'), ['writing'], {
            data: () => [writingQuery('cv')],
            skeleton: 'form',
          }),
        },
        // Design: canvas V8 "فرم‌های نگارش دیگر" (AppRecForm, AppProfForm).
        {
          path: 'documents/recommendation',
          ...lazyPage(() => import('@/features/writing/RecommendationFormPage'), ['writing'], {
            data: () => [writingQuery('recommendation')],
            skeleton: 'form',
          }),
        },
        {
          path: 'documents/pl',
          ...lazyPage(() => import('@/features/writing/PlFormPage'), ['writing'], {
            data: () => [writingQuery('pl')],
            skeleton: 'form',
          }),
        },
        // PS and DS: the SOP form with their own questions (canvas V8 note), Django's
        // PersonalStatement and DiversityStatement.
        {
          path: 'documents/ps',
          ...lazyPage(() => import('@/features/writing/PsFormPage'), ['writing'], {
            data: () => [writingQuery('ps')],
            skeleton: 'form',
          }),
        },
        {
          path: 'documents/ds',
          ...lazyPage(() => import('@/features/writing/DsFormPage'), ['writing'], {
            data: () => [writingQuery('ds')],
            skeleton: 'form',
          }),
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
            prefetchTickets(applicantTickets, params['*'] ?? '');
            return null;
          },
          ...lazyPage(() => import('./TicketsPage'), ['tickets'], { skeleton: 'chat' }),
        },
        // Design: canvas V6 sections 7 (contract) and 11 (payment details).
        {
          path: 'contract',
          ...lazyPage(() => import('@/features/contract/ContractPage'), ['contract'], {
            data: () => [contractQuery],
            skeleton: 'detail',
          }),
        },
        {
          // An invoice: an instalment, or a purchase from "other services".
          path: 'payments/:id',
          ...lazyPage(() => import('@/features/contract/PaymentPage'), ['contract'], {
            data: ({ params }) => {
              const id = idParam(params.id);
              return [id !== null && paymentQuery(id)];
            },
            skeleton: 'detail',
          }),
        },
        // Design: canvas V6 section 9. Open with or without a contract.
        {
          path: 'services',
          ...lazyPage(() => import('@/features/services/ServicesPage'), ['services'], {
            data: () => [servicesQuery],
            skeleton: 'dashboard',
          }),
        },
        // A bought package, an event. Design: canvas V6 section 13 (reached from services).
        {
          path: 'services/packages/:id',
          ...lazyPage(() => import('@/features/services/PackagePage'), ['services'], {
            data: ({ params }) => {
              const id = idParam(params.id);
              return [id !== null && packageQuery(id)];
            },
            skeleton: 'detail',
          }),
        },
        {
          path: 'services/events/:id',
          ...lazyPage(() => import('@/features/services/EventPage'), ['services'], {
            data: ({ params }) => {
              const id = idParam(params.id);
              return [id !== null && eventQuery(id)];
            },
            skeleton: 'detail',
          }),
        },
        // Booked consultations and one session. Design: canvas V6 section 15 (reached from services).
        {
          path: 'consultations',
          ...lazyPage(
            () => import('@/features/consultations/ConsultationsPage'),
            ['consultations'],
            { data: () => [consultationsQuery], skeleton: 'list' },
          ),
        },
        {
          path: 'consultations/:id',
          ...lazyPage(
            () => import('@/features/consultations/ConsultationPage'),
            ['consultations'],
            {
              data: ({ params }) => {
                const id = idParam(params.id);
                return [id !== null && consultationQuery(id)];
              },
              skeleton: 'detail',
            },
          ),
        },
        // The free Turkey application (no nav item: the guest home links to it). Canvas V7 section 3.
        ON_SERVER.turkey
          ? {
              path: 'turkey',
              ...lazyPage(() => import('@/features/turkey/TurkeyPage'), ['turkey'], {
                data: () => [turkeyQuery],
                skeleton: 'form',
              }),
            }
          : { path: 'turkey', element: <ComingSoonPage title="panels.applicant.nav.home" /> },
      ],
    },
  ],
};
