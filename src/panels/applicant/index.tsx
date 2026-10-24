import { ComingSoonPage } from '@/components/ComingSoonPage';
import { applicationsQuery } from '@/features/applications/api';
import { contractQuery, paymentQuery } from '@/features/contract/api';
import { turkeyQuery } from '@/features/turkey/api';
import { documentsQuery } from '@/features/documents/api';
import { overviewQuery } from '@/features/home/api';
import { writingQuery } from '@/features/writing/api';
import { queryClient } from '@/lib/api/queryClient';
import { accessQuery, useLockedNav } from '@/lib/applicant/access';
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
      index: true,
      // Start the case request together with the page chunk, not after it.
      loader: () => {
        // A failure here shows up when the page reads the query.
        queryClient.query(overviewQuery).catch(() => undefined);
        queryClient.query(accessQuery).catch(() => undefined);
        return null;
      },
      ...lazyPage(() => import('@/features/home/HomePage'), ['home']),
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
    // Other writing orders (recommendation, PS, …) get a form later.
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
    { path: 'services', element: <ComingSoonPage title="panels.applicant.nav.services" /> },
    // The free Turkey application (no nav item: the guest home links to it). Canvas V7 section 3.
    {
      path: 'turkey',
      loader: () => {
        queryClient.query(turkeyQuery).catch(() => undefined);
        return null;
      },
      ...lazyPage(() => import('@/features/turkey/TurkeyPage'), ['turkey']),
    },
  ],
};
