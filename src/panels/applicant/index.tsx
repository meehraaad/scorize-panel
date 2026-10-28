import { ComingSoonPage } from '@/components/ComingSoonPage';
import { applicationsQuery } from '@/features/applications/api';
import { Navigate } from 'react-router';
import {
  consultationQuery,
  consultationsQuery,
  sessionSummariesQuery,
} from '@/features/consultations/api';
import {
  campaignQuery,
  contractQuery,
  openPaymentsQuery,
  paymentQuery,
} from '@/features/contract/api';
import { eventQuery, packageQuery, servicesQuery } from '@/features/services/api';
import { estimateOptionsQuery, latestEstimateQuery } from '@/lib/applicant/estimate';
import { turkeyQuery } from '@/features/turkey/api';
import { documentsQuery } from '@/features/documents/api';
import { writingOffersQuery } from '@/features/documents/offers';
import { overviewQuery } from '@/features/home/api';
import { writingQuery } from '@/features/writing/api';
import { queryClient } from '@/lib/api/queryClient';
import { accessQuery, useHiddenNav } from '@/lib/applicant/access';
import { guestInterestsQuery } from '@/lib/applicant/documents';
import { SESSION_PARAM } from '@/lib/applicant/consultations';
import { ON_SERVER } from '@/lib/applicant/onServer';
import { firstCalendarQuery } from '@/lib/applicant/booking';
import { weekStart } from '@/lib/calendar';
import i18n from '@/lib/i18n';
import { calendarKind } from '@/lib/i18n/useCalendar';
import { activitiesQuery } from '@/lib/applicant/activities';
import { gatesQuery } from '@/lib/applicant/gates';
import { backgroundQuery, reviewDocumentsQuery, startQuery } from '@/lib/applicant/journey';
import { idParam, lazyPage } from '@/lib/router/lazyPage';
import { prefetchTickets } from '@/features/tickets/config';
import type { PanelDefinition } from '../types';
import { CampaignFormRedirect, SessionRedirect } from './SessionRedirect';
import { applicantTickets } from '@/lib/applicant/tickets';

/** Every account has this panel. Design: canvas V6/V7 "پنل متقاضی". */
export const applicantPanel: PanelDefinition = {
  id: 'applicant',
  path: '',
  name: 'panels.applicant.name',
  description: 'panels.applicant.description',
  icon: 'user',
  tone: 'neutral',
  navLabel: 'panels.applicant.nav.label',
  // Without a contract the tickets tab is hidden; other sections show a locked preview (canvas V7).
  useHiddenNav,
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
        // The to-do box over every page asks for its list with the gates.
        data: () => [gatesQuery, ON_SERVER.activities && activitiesQuery],
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
            ['applications', 'home', 'estimate', 'documents'],
            {
              // With a case: its applications and research interests. Without one, the page that
              // sells the service: the chance form reads the quiz's choices and last result.
              data: () => {
                const state = queryClient.getQueryData(accessQuery.queryKey)?.state ?? 'guest';
                const guest = state === 'guest';
                return [
                  applicationsQuery,
                  // The case's research interests. Opened first (access not known yet), it loads
                  // them too, as the documents tab does: a guest gets a 404 and nothing is shown.
                  documentsQuery,
                  guest && ON_SERVER.estimate && estimateOptionsQuery,
                  guest && ON_SERVER.estimate && latestEstimateQuery,
                  guest && guestInterestsQuery,
                ];
              },
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
          ...lazyPage(() => import('@/features/writing/SopFormPage'), ['writing', 'tickets'], {
            data: () => [writingQuery('sop')],
            skeleton: 'form',
          }),
        },
        {
          path: 'documents/cv',
          ...lazyPage(() => import('@/features/writing/CvFormPage'), ['writing', 'tickets'], {
            data: () => [writingQuery('cv')],
            skeleton: 'form',
          }),
        },
        // Design: canvas V8 "فرم‌های نگارش دیگر" (AppRecForm, AppProfForm).
        {
          path: 'documents/recommendation',
          ...lazyPage(
            () => import('@/features/writing/RecommendationFormPage'),
            ['writing', 'tickets'],
            {
              data: () => [writingQuery('recommendation')],
              skeleton: 'form',
            },
          ),
        },
        {
          path: 'documents/pl',
          ...lazyPage(() => import('@/features/writing/PlFormPage'), ['writing', 'tickets'], {
            data: () => [writingQuery('pl')],
            skeleton: 'form',
          }),
        },
        // PS and DS: the SOP form with their own questions (canvas V8 note), Django's
        // PersonalStatement and DiversityStatement.
        {
          path: 'documents/ps',
          ...lazyPage(() => import('@/features/writing/PsFormPage'), ['writing', 'tickets'], {
            data: () => [writingQuery('ps')],
            skeleton: 'form',
          }),
        },
        {
          path: 'documents/ds',
          ...lazyPage(() => import('@/features/writing/DsFormPage'), ['writing', 'tickets'], {
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
          ...lazyPage(
            () => import('@/features/contract/ContractPage'),
            ['contract', 'applications'],
            {
              // Without a contract the tab sells the next step: the two contracts and the research
              // interests they can save already. A case with a contract doesn't read them.
              data: () => {
                const state = queryClient.getQueryData(accessQuery.queryKey)?.state ?? 'guest';
                const guest = state === 'guest';
                return [contractQuery, guest && ON_SERVER.guestInterests && guestInterestsQuery];
              },
              skeleton: 'detail',
            },
          ),
        },
        {
          // An invoice from buying to what comes next: an instalment, a services purchase, a booked
          // session, a campaign, a seller's invoice. Design: canvas "Scorize Payment States".
          path: 'payments/:id',
          ...lazyPage(() => import('@/features/contract/PaymentPage'), ['contract'], {
            data: ({ params }) => {
              const id = idParam(params.id);
              // A paid one lists the to-dos it left (the to-do box's list).
              return [id !== null && paymentQuery(id), ON_SERVER.activities && activitiesQuery];
            },
            skeleton: 'detail',
          }),
        },
        // The open payments (canvas A3).
        {
          path: 'payments',
          ...lazyPage(() => import('@/features/contract/OpenPaymentsPage'), ['contract'], {
            data: () => [openPaymentsQuery],
            skeleton: 'list',
          }),
        },
        // A campaign registered in the panel (canvas E1, E2); its form is the background form.
        {
          path: 'campaigns/:slug',
          ...lazyPage(() => import('@/features/contract/CampaignPage'), ['contract'], {
            data: ({ params }) => [campaignQuery(params.slug ?? '')],
            skeleton: 'detail',
          }),
        },
        { path: 'campaigns/:slug/form', element: <CampaignFormRedirect /> },
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
