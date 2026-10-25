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
import { lazyPage } from '@/lib/router/lazyPage';
import { ticketsQuery } from '@/lib/tickets/api';
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
      loader: () => {
        queryClient.query(gatesQuery).catch(() => undefined);
        return null;
      },
      ...lazyPage(() => import('@/features/gates/GatesLayout'), ['gates']),
      children: [
        {
          index: true,
          // Start the case request together with the page chunk, not after it.
          loader: () => {
            // A failure here shows up when the page reads the query.
            queryClient.query(overviewQuery).catch(() => undefined);
            queryClient.query(accessQuery).catch(() => undefined);
            return null;
          },
          ...lazyPage(() => import('@/features/home/HomePage'), ['home', 'gates']),
        },
        {
          path: 'applications',
          loader: () => {
            queryClient.query(applicationsQuery).catch(() => undefined);
            queryClient.query(accessQuery).catch(() => undefined);
            return null;
          },
          ...lazyPage(() => import('@/features/applications/ApplicationsPage'), ['applications']),
        },
        {
          path: 'documents',
          loader: () => {
            queryClient.query(documentsQuery).catch(() => undefined);
            queryClient.query(accessQuery).catch(() => undefined);
            return null;
          },
          ...lazyPage(() => import('@/features/documents/DocumentsPage'), ['documents']),
        },
        // Writing information forms. Design: canvas V6 sections 4 (SOP) and 5 (CV).
        {
          path: 'documents/sop',
          loader: () => {
            queryClient.query(writingQuery('sop')).catch(() => undefined);
            return null;
          },
          ...lazyPage(() => import('@/features/writing/SopFormPage'), ['writing']),
        },
        {
          path: 'documents/cv',
          loader: () => {
            queryClient.query(writingQuery('cv')).catch(() => undefined);
            return null;
          },
          ...lazyPage(() => import('@/features/writing/CvFormPage'), ['writing']),
        },
        // Design: canvas V8 "فرم‌های نگارش دیگر" (AppRecForm, AppProfForm).
        {
          path: 'documents/recommendation',
          loader: () => {
            queryClient.query(writingQuery('recommendation')).catch(() => undefined);
            return null;
          },
          ...lazyPage(() => import('@/features/writing/RecommendationFormPage'), ['writing']),
        },
        {
          path: 'documents/pl',
          loader: () => {
            queryClient.query(writingQuery('pl')).catch(() => undefined);
            return null;
          },
          ...lazyPage(() => import('@/features/writing/PlFormPage'), ['writing']),
        },
        // PS and DS: the SOP form with their own questions (canvas V8 note), Django's
        // PersonalStatement and DiversityStatement.
        {
          path: 'documents/ps',
          loader: () => {
            queryClient.query(writingQuery('ps')).catch(() => undefined);
            return null;
          },
          ...lazyPage(() => import('@/features/writing/PsFormPage'), ['writing']),
        },
        {
          path: 'documents/ds',
          loader: () => {
            queryClient.query(writingQuery('ds')).catch(() => undefined);
            return null;
          },
          ...lazyPage(() => import('@/features/writing/DsFormPage'), ['writing']),
        },
        // Any other writing order: no form in the panel.
        {
          path: 'documents/:writing',
          element: <ComingSoonPage title="panels.applicant.nav.documents" />,
        },
        // Supervisor and writing tickets. Design: canvas V6 "تیکت‌ها" / "تیکت نگارش" (AppTickets).
        {
          path: 'tickets/*',
          loader: () => {
            queryClient.query(ticketsQuery(applicantTickets)).catch(() => undefined);
            queryClient.query(accessQuery).catch(() => undefined);
            return null;
          },
          ...lazyPage(() => import('./TicketsPage'), ['tickets']),
        },
        // Design: canvas V6 sections 7 (contract) and 11 (payment details).
        {
          path: 'contract',
          loader: () => {
            queryClient.query(contractQuery).catch(() => undefined);
            queryClient.query(accessQuery).catch(() => undefined);
            return null;
          },
          ...lazyPage(() => import('@/features/contract/ContractPage'), ['contract']),
        },
        {
          // An invoice: an instalment, or a purchase from "other services".
          path: 'payments/:id',
          loader: ({ params }) => {
            const id = Number(params.id);
            if (Number.isInteger(id) && id > 0)
              queryClient.query(paymentQuery(id)).catch(() => undefined);
            return null;
          },
          ...lazyPage(() => import('@/features/contract/PaymentPage'), ['contract']),
        },
        // Design: canvas V6 section 9. Open with or without a contract.
        {
          path: 'services',
          loader: () => {
            queryClient.query(servicesQuery).catch(() => undefined);
            return null;
          },
          ...lazyPage(() => import('@/features/services/ServicesPage'), ['services']),
        },
        // A bought package, an event. Design: canvas V6 section 13 (reached from services).
        {
          path: 'services/packages/:id',
          loader: ({ params }) => {
            const id = Number(params.id);
            if (Number.isInteger(id) && id > 0)
              queryClient.query(packageQuery(id)).catch(() => undefined);
            return null;
          },
          ...lazyPage(() => import('@/features/services/PackagePage'), ['services']),
        },
        {
          path: 'services/events/:id',
          loader: ({ params }) => {
            const id = Number(params.id);
            if (Number.isInteger(id) && id > 0)
              queryClient.query(eventQuery(id)).catch(() => undefined);
            return null;
          },
          ...lazyPage(() => import('@/features/services/EventPage'), ['services']),
        },
        // Booked consultations and one session. Design: canvas V6 section 15 (reached from services).
        {
          path: 'consultations',
          loader: () => {
            queryClient.query(consultationsQuery).catch(() => undefined);
            return null;
          },
          ...lazyPage(
            () => import('@/features/consultations/ConsultationsPage'),
            ['consultations'],
          ),
        },
        {
          path: 'consultations/:id',
          loader: ({ params }) => {
            const id = Number(params.id);
            if (Number.isInteger(id) && id > 0)
              queryClient.query(consultationQuery(id)).catch(() => undefined);
            return null;
          },
          ...lazyPage(() => import('@/features/consultations/ConsultationPage'), ['consultations']),
        },
        // The free Turkey application (no nav item: the guest home links to it). Canvas V7 section 3.
        ON_SERVER.turkey
          ? {
              path: 'turkey',
              loader: () => {
                queryClient.query(turkeyQuery).catch(() => undefined);
                return null;
              },
              ...lazyPage(() => import('@/features/turkey/TurkeyPage'), ['turkey']),
            }
          : { path: 'turkey', element: <ComingSoonPage title="panels.applicant.nav.home" /> },
      ],
    },
  ],
};
