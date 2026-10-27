import { ComingSoonPage } from '@/components/ComingSoonPage';
import { applicationsQuery } from '@/features/applications/api';
import { Navigate } from 'react-router';
import {
  consultationQuery,
  consultationsQuery,
  sessionSummariesQuery,
} from '@/features/consultations/api';
import { contractQuery, paymentQuery } from '@/features/contract/api';
import { eventQuery, packageQuery, servicesQuery } from '@/features/services/api';
import { estimateOptionsQuery, latestEstimateQuery } from '@/lib/applicant/estimate';
import { turkeyQuery } from '@/features/turkey/api';
import { documentsQuery } from '@/features/documents/api';
import { writingOffersQuery } from '@/features/documents/offers';
import { overviewQuery } from '@/features/home/api';
import { writingQuery } from '@/features/writing/api';
import { queryClient } from '@/lib/api/queryClient';
import { accessQuery, useLockedNav } from '@/lib/applicant/access';
import { SESSION_PARAM } from '@/lib/applicant/consultations';
import { ON_SERVER } from '@/lib/applicant/onServer';
import { firstCalendarQuery } from '@/lib/applicant/booking';
import { weekStart } from '@/lib/calendar';
import i18n from '@/lib/i18n';
import { calendarKind } from '@/lib/i18n/useCalendar';
import { gatesQuery } from '@/lib/applicant/gates';
import { backgroundQuery, reviewDocumentsQuery, startQuery } from '@/lib/applicant/journey';
import { idParam, lazyPage } from '@/lib/router/lazyPage';
import { prefetchTickets } from '@/features/tickets/config';
import type { PanelDefinition } from '../types';
import { SessionRedirect } from './SessionRedirect';
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
    // Documents before applications: an application waits for them, and they are the applicant's work.
    {
      id: 'documents',
      to: 'documents',
      label: 'panels.applicant.nav.documents',
      tab: 'panels.applicant.tabs.documents',
      icon: 'document',
    },
    {
      id: 'applications',
      to: 'applications',
      label: 'panels.applicant.nav.applications',
      tab: 'panels.applicant.tabs.applications',
      icon: 'graduation',
    },
    {
      id: 'tickets',
      to: 'tickets',
      label: 'panels.applicant.nav.tickets',
      tab: 'panels.applicant.tabs.tickets',
      icon: 'chat',
    },
    { id: 'contract', to: 'contract', label: 'panels.applicant.nav.contract', icon: 'card' },
    { id: 'services', to: 'services', label: 'panels.applicant.nav.services', icon: 'play' },
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
          ...lazyPage(
            () => import('@/features/home/HomePage'),
            ['home', 'gates', 'estimate', 'journey', 'booking', 'consultations'],
            {
              // Without a contract the home is the journey toward one: the admission-chance quiz
              // (or its last result), the tablet form, the next session and what to start with
              // (free times, prices, their seller). A case with a contract (or one in review)
              // reads none of them. Every home but one in review lists the sessions and what the
              // consultant wrote after each (there is no consultations page).
              data: ({ request }) => {
                const state = queryClient.getQueryData(accessQuery.queryKey)?.state;
                // A session's details open over the home (`?session=41`).
                const opened = idParam(
                  new URL(request.url).searchParams.get(SESSION_PARAM) ?? undefined,
                );
                const guest = ON_SERVER.estimate && state !== 'active' && state !== 'pending';
                const sessions = state !== 'pending';
                return [
                  overviewQuery,
                  guest && latestEstimateQuery,
                  guest && estimateOptionsQuery,
                  guest && backgroundQuery,
                  sessions && consultationsQuery,
                  sessions && sessionSummariesQuery(),
                  opened !== null && consultationQuery(opened),
                  guest && startQuery,
                  // The consultation card's first free time per mode (the booking page's first read).
                  guest &&
                    ON_SERVER.bookingCalendar &&
                    firstCalendarQuery(weekStart(calendarKind(i18n.language))),
                ];
              },
              skeleton: 'dashboard',
            },
          ),
        },
        {
          path: 'applications',
          ...lazyPage(
            () => import('@/features/applications/ApplicationsPage'),
            ['applications', 'home'],
            {
              data: () => [applicationsQuery],
              skeleton: 'list',
            },
          ),
        },
        {
          path: 'documents',
          ...lazyPage(() => import('@/features/documents/DocumentsPage'), ['documents'], {
            // Without a contract the tab is the new user's: files sent for the free review and
            // the writing offered next to them. Opened first (access not known yet), it loads
            // them too, as the home does.
            data: () => {
              const state = queryClient.getQueryData(accessQuery.queryKey)?.state ?? 'guest';
              const guest = ON_SERVER.writingOffers && state === 'guest';
              return [documentsQuery, guest && reviewDocumentsQuery, guest && writingOffersQuery];
            },
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
            // Without a contract the tab sells the next step: their session notes and admissions
            // of people like them (the last quiz result). A case with a contract reads neither.
            data: () => {
              const state = queryClient.getQueryData(accessQuery.queryKey)?.state ?? 'guest';
              const guest = state === 'guest';
              return [
                contractQuery,
                guest && sessionSummariesQuery(),
                guest && ON_SERVER.estimate && latestEstimateQuery,
              ];
            },
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
        // The consultations pages are gone: the home lists every session and opens one over
        // itself. Old links (SMS, bookmarks) land there.
        { path: 'consultations', element: <Navigate to="/" replace /> },
        // Booking one on a week calendar (design: "Consultation Booking Design" canvas).
        ...(ON_SERVER.bookingCalendar
          ? [
              {
                path: 'consultations/book',
                ...lazyPage(() => import('@/features/consultations/BookPage'), ['booking'], {
                  data: () => [firstCalendarQuery(weekStart(calendarKind(i18n.language)))],
                  skeleton: 'board',
                }),
              },
            ]
          : []),
        { path: 'consultations/:id', element: <SessionRedirect /> },
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
        // The admission-chance quiz of the new-user dashboard (no nav item: the guest home links to it).
        ON_SERVER.estimate
          ? {
              path: 'estimate',
              ...lazyPage(() => import('@/features/estimate/EstimatePage'), ['estimate'], {
                data: () => [accessQuery, latestEstimateQuery, estimateOptionsQuery],
                skeleton: 'form',
              }),
            }
          : { path: 'estimate', element: <ComingSoonPage title="panels.applicant.nav.home" /> },
        // The tablet form (no nav item: the new-user home and the session card link to it).
        ON_SERVER.background
          ? {
              path: 'background',
              ...lazyPage(() => import('@/features/background/BackgroundPage'), ['journey'], {
                data: () => [backgroundQuery],
                skeleton: 'form',
              }),
            }
          : { path: 'background', element: <ComingSoonPage title="panels.applicant.nav.home" /> },
      ],
    },
  ],
};
