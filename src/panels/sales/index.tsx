import { redirect } from 'react-router';
import {
  MANAGER_PERMISSION,
  activityQuery,
  applyQuery,
  approvalDocumentQuery,
  approvalsQuery,
  assignQuery,
  boardQuery,
  commissionQuery,
  stagesQuery,
  managerTagsQuery,
  contractBuilderQuery,
  templateParam,
  tagsQuery,
  sellerCalendarQuery,
  contractDocumentQuery,
  customerQuery,
  firstLeadQuery,
  leadsQuery,
  healthQuery,
  historyQuery,
  infoQuery,
  leadFilterOf,
  handoffQuery,
  offerQuery,
  outreachQuery,
  agreementQuery,
  paymentsQuery,
  purchasesQuery,
  receiptsQuery,
  sellerDayQuery,
  teamQuery,
  funnelQuery,
} from '@/features/sales/api';
import HeaderCustomerSearch from '@/features/sales/components/HeaderCustomerSearch';
import { PhoneBreakMenu } from '@/features/sales/components/PhoneBreak';
import { usePhoneStatus } from '@/features/sales/components/usePhoneStatus';
import { queryClient } from '@/lib/api/queryClient';
import { weekOf, weekStart } from '@/lib/calendar';
import i18n from '@/lib/i18n';
import { calendarKind } from '@/lib/i18n/useCalendar';
import { ON_SERVER } from '@/lib/applicant/onServer';
import { hasPermission } from '@/lib/auth/roles';
import { sessionQuery } from '@/lib/auth/session';
import { idParam, lazyPage } from '@/lib/router/lazyPage';
import { notebookQuery } from '@/lib/notes/api';
import { SALES_API } from '@/lib/sales/api';
import {
  officeHoursQuery,
  phoneMenusQuery,
  phoneTeamsQuery,
  phoneBreakQuery,
  phoneVoicesQuery,
  teamBreaksQuery,
} from '@/lib/sales/phoneCalls';
import { PHONE_SECTIONS } from '@/features/sales/manager/phoneSections';
import { openingTaskList, taskListQuery, tasksQuery } from '@/lib/tasks/api';
import type { LoaderFunctionArgs } from 'react-router';
import type { PanelDefinition } from '../types';

/** A customer page's id, or null (the page says the customer doesn't exist). */
const customerOf = ({ params }: LoaderFunctionArgs) => idParam(params.id);

/** `customers/:id/purchases|payments` (with `?payment=`) → the one "contract and money" tab. */
const toMoney = ({ params, request }: LoaderFunctionArgs) =>
  redirect(`/sales/customers/${params.id ?? ''}/money${new URL(request.url).search}`);

/** Sellers without the manager's permission are sent back to the panel's home. */
async function managerOnly() {
  const user = await queryClient.query({ ...sessionQuery, staleTime: 'static' });
  return user && hasPermission(user, MANAGER_PERMISSION) ? null : redirect('/sales');
}

/** Sales and support teams (User.is_seller). Design: canvas "Scorize Seller Panel". */
export const salesPanel: PanelDefinition = {
  id: 'sales',
  path: 'sales',
  name: 'panels.sales.name',
  description: 'panels.sales.description',
  icon: 'phone',
  tone: 'warn',
  navLabel: 'panels.sales.nav.label',
  navigation: [
    {
      id: 'today',
      to: '',
      label: 'panels.sales.nav.today',
      tab: 'panels.sales.tabs.today',
      icon: 'home',
    },
    {
      id: 'board',
      to: 'board',
      label: 'panels.sales.nav.board',
      tab: 'panels.sales.tabs.board',
      icon: 'grid',
    },
    {
      id: 'calendar',
      to: 'calendar',
      label: 'panels.sales.nav.calendar',
      tab: 'panels.sales.tabs.calendar',
      icon: 'calendar',
    },
    {
      id: 'leads',
      to: 'leads',
      label: 'panels.sales.nav.leads',
      tab: 'panels.sales.tabs.leads',
      icon: 'user',
    },
    {
      id: 'tasks',
      to: 'tasks',
      label: 'panels.sales.nav.tasks',
      tab: 'panels.sales.tabs.tasks',
      icon: 'check',
    },
    {
      id: 'month',
      to: 'month',
      label: 'panels.sales.nav.month',
      tab: 'panels.sales.tabs.month',
      icon: 'chart',
    },
    {
      id: 'manager',
      to: 'manager',
      label: 'panels.sales.nav.manager',
      icon: 'settings',
      permission: MANAGER_PERMISSION,
    },
  ],
  // Search every customer from any page (S63), not only the leads page's button.
  ...(ON_SERVER.customerSearch && { headerAction: HeaderCustomerSearch }),
  // The avatar ring reads the break state on every page.
  ...(ON_SERVER.phoneBreak && { data: () => [phoneBreakQuery] }),
  // Phone state on the avatar ring and the break button in the account menu.
  ...(ON_SERVER.phoneBreak && { account: { useStatus: usePhoneStatus, Menu: PhoneBreakMenu } }),
  // Each route lists what its page shows first (docs/performance.md, "Page data").
  routes: [
    {
      index: true,
      ...lazyPage(() => import('@/features/sales/TodayPage'), ['sales'], {
        data: () => [
          outreachQuery(1, 1, 'overdue'),
          activityQuery(1),
          receiptsQuery(1),
          taskListQuery('sales', 'mine', 1),
          taskListQuery('sales', 'requests', 1),
          // Today's calendar: the popup a consultation or follow-up card opens.
          sellerDayQuery(new Date(new Date().setHours(0, 0, 0, 0))),
          // The header's break from team calls.
        ],
        skeleton: 'dashboard',
      }),
    },
    {
      path: 'leads',
      ...lazyPage(() => import('@/features/sales/LeadsLayout'), ['sales']),
      children: [
        {
          index: true,
          ...lazyPage(() => import('@/features/sales/LeadsPage'), [], {
            data: ({ request }) => [
              leadsQuery(
                firstLeadQuery(leadFilterOf(new URL(request.url).searchParams.get('stage'))),
              ),
              ON_SERVER.customerTags && tagsQuery,
            ],
            skeleton: 'list',
          }),
        },
        // Its address while it was a sub-tab of the leads.
        { path: 'consultations', loader: () => redirect('/sales/calendar') },
      ],
    },
    // The seller's calendar has its own nav tab: consultations and timed follow-ups.
    {
      path: 'calendar',
      // `tasks`: a click on a day's tasks opens the new-task composer.
      ...lazyPage(() => import('@/features/sales/LeadsLayout'), ['sales', 'tasks']),
      children: [
        {
          index: true,
          ...lazyPage(() => import('@/features/sales/ConsultationsPage'), [], {
            // Opens on this week's calendar; the list reads its own page when chosen.
            data: () => [
              sellerCalendarQuery(weekOf(new Date(), weekStart(calendarKind(i18n.language)))),
            ],
            skeleton: 'board',
          }),
        },
      ],
    },
    {
      path: 'board',
      ...lazyPage(() => import('@/features/sales/BoardPage'), ['sales'], {
        data: () => [boardQuery],
        skeleton: 'board',
      }),
    },
    {
      path: 'month',
      // No data on open: the month is read only after the seller types their password.
      ...lazyPage(() => import('@/features/sales/MonthPage'), ['sales'], { skeleton: 'form' }),
    },
    // Its first address.
    { path: 'consultations', loader: () => redirect('/sales/calendar') },
    {
      path: 'customers/:id',
      ...lazyPage(() => import('@/features/sales/CustomerLayout'), ['sales', 'notes'], {
        data: (args) => {
          const id = customerOf(args);
          return [
            id !== null && customerQuery(id),
            ON_SERVER.customerTags && tagsQuery,
            id !== null && notebookQuery(`${SALES_API}/customers/${String(id)}/notes/`),
          ];
        },
        skeleton: 'customer',
      }),
      // Each tab's data starts with the customer's, not after it.
      children: [
        {
          index: true,
          ...lazyPage(() => import('@/features/sales/CustomerSummaryPage'), [], {
            data: (args) => {
              const id = customerOf(args);
              // The contract card (S71): the open offer, or the approved contract.
              return id === null ? [] : [historyQuery(id), offerQuery(id), handoffQuery(id)];
            },
          }),
        },
        {
          path: 'money',
          ...lazyPage(() => import('@/features/sales/CustomerMoneyPage'), [], {
            data: (args) => {
              const id = customerOf(args);
              return id === null ? [] : [purchasesQuery(id), paymentsQuery(id), agreementQuery(id)];
            },
          }),
        },
        // Their first addresses (links in old messages and other pages): one tab now.
        { path: 'purchases', loader: toMoney },
        { path: 'payments', loader: toMoney },
        {
          path: 'info',
          ...lazyPage(() => import('@/features/sales/CustomerInfoPage'), [], {
            data: (args) => {
              const id = customerOf(args);
              return [id !== null && infoQuery(id)];
            },
          }),
        },
        {
          path: 'apply',
          ...lazyPage(() => import('@/features/sales/CustomerApplyPage'), [], {
            data: (args) => {
              const id = customerOf(args);
              return [id !== null && applyQuery(id), id !== null && handoffQuery(id)];
            },
          }),
        },
      ],
    },
    // Its own page (no customer card): building an offer takes the whole screen.
    {
      path: 'customers/:id/offer',
      ...lazyPage(() => import('@/features/sales/OfferPage'), ['sales'], {
        data: (args) => {
          const id = customerOf(args);
          if (id === null) return [];
          const template = new URL(args.request.url).searchParams.get('template');
          return [
            customerQuery(id),
            offerQuery(id, template === null ? undefined : templateParam(template)),
          ];
        },
        skeleton: 'form',
      }),
    },
    // The approved contract to print and sign (S52): a page of its own, without the customer card.
    {
      path: 'customers/:id/contract',
      ...lazyPage(() => import('@/features/sales/ContractPrintPage'), ['sales'], {
        data: (args) => {
          const id = customerOf(args);
          return id === null ? [] : [customerQuery(id), contractDocumentQuery(id)];
        },
        skeleton: 'detail',
      }),
    },
    // An offer's contract before approval (S68), to print: a page of its own, outside the section's tabs.
    {
      path: 'manager/approvals/:id/contract',
      ...lazyPage(() => import('@/features/sales/manager/ApprovalPrintPage'), ['sales'], {
        guard: managerOnly,
        data: ({ params }) => {
          const id = idParam(params.id);
          return id === null ? [] : [approvalDocumentQuery(id)];
        },
        skeleton: 'detail',
      }),
    },
    // The sales manager's section (nav item and routes need can_assign_to_seller).
    {
      path: 'manager',
      loader: managerOnly,
      ...lazyPage(() => import('@/features/sales/manager/ManagerLayout'), ['sales']),
      children: [
        {
          index: true,
          ...lazyPage(() => import('@/features/sales/manager/AssignPage'), [], {
            data: () => [assignQuery(1)],
            skeleton: 'list',
          }),
        },
        {
          path: 'approvals',
          ...lazyPage(() => import('@/features/sales/manager/ApprovalsPage'), [], {
            data: () => [approvalsQuery],
            skeleton: 'list',
          }),
        },
        {
          path: 'contract',
          ...lazyPage(() => import('@/features/sales/manager/ContractBuilderPage'), [], {
            data: ({ request }) => [
              contractBuilderQuery(
                templateParam(new URL(request.url).searchParams.get('template')),
              ),
            ],
            skeleton: 'form',
          }),
        },
        {
          path: 'team',
          ...lazyPage(() => import('@/features/sales/manager/TeamPage'), [], {
            data: () => [teamQuery('month'), ON_SERVER.estimate && funnelQuery('month')],
            skeleton: 'dashboard',
          }),
        },
        {
          path: 'commission',
          ...lazyPage(() => import('@/features/sales/manager/CommissionPage'), [], {
            data: () => [commissionQuery],
            skeleton: 'form',
          }),
        },
        {
          path: 'follow-ups',
          ...lazyPage(() => import('@/features/sales/manager/FollowUpHealthPage'), [], {
            data: () => [healthQuery('all')],
            skeleton: 'list',
          }),
        },
        {
          path: 'stages',
          ...lazyPage(() => import('@/features/sales/manager/StagesPage'), [], {
            data: () => [stagesQuery],
            skeleton: 'form',
          }),
        },
        {
          path: 'tags',
          ...lazyPage(() => import('@/features/sales/manager/TagsPage'), [], {
            data: () => [managerTagsQuery],
            skeleton: 'list',
          }),
        },
        // The office line: one tab, a sub-tab per setting (PhoneLayout).
        ...(PHONE_SECTIONS.length
          ? [
              {
                path: 'phone',
                ...lazyPage(() => import('@/features/sales/manager/PhoneLayout'), []),
                children: [
                  {
                    index: true,
                    loader: () => redirect(`/sales/manager/phone/${PHONE_SECTIONS[0]?.path ?? ''}`),
                  },
                  ...(ON_SERVER.officeHours
                    ? [
                        {
                          path: 'hours',
                          ...lazyPage(
                            () => import('@/features/sales/manager/OfficeHoursPage'),
                            [],
                            {
                              data: () => [officeHoursQuery],
                              skeleton: 'form',
                            },
                          ),
                        },
                      ]
                    : []),
                  ...(ON_SERVER.phoneTeams
                    ? [
                        {
                          path: 'teams',
                          ...lazyPage(() => import('@/features/sales/manager/PhoneTeamsPage'), [], {
                            data: () => [
                              phoneTeamsQuery,
                              ...(ON_SERVER.teamBreaks ? [teamBreaksQuery] : []),
                            ],
                            skeleton: 'form',
                          }),
                        },
                      ]
                    : []),
                  ...(ON_SERVER.phoneMenus
                    ? [
                        {
                          path: 'menus',
                          ...lazyPage(() => import('@/features/sales/manager/PhoneMenusPage'), [], {
                            data: () => [phoneMenusQuery],
                            skeleton: 'form',
                          }),
                        },
                      ]
                    : []),
                  ...(ON_SERVER.phoneVoices
                    ? [
                        {
                          path: 'voices',
                          ...lazyPage(
                            () => import('@/features/sales/manager/PhoneVoicesPage'),
                            [],
                            {
                              data: () => [phoneVoicesQuery],
                              skeleton: 'list',
                            },
                          ),
                        },
                      ]
                    : []),
                ],
              },
            ]
          : []),
        // Old addresses (bookmarks) of the phone pages.
        { path: 'hours', loader: () => redirect('/sales/manager/phone/hours') },
        { path: 'phone-teams', loader: () => redirect('/sales/manager/phone/teams') },
        { path: 'phone-menus', loader: () => redirect('/sales/manager/phone/menus') },
        { path: 'phone-voices', loader: () => redirect('/sales/manager/phone/voices') },
      ],
    },
    {
      path: 'tasks',
      ...lazyPage(() => import('./TasksPage'), ['tasks'], {
        data: ({ request }) => [tasksQuery('sales'), openingTaskList('sales', request.url)],
        skeleton: 'list',
      }),
    },
  ],
};
