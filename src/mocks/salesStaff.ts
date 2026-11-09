import { summaryForContact } from './sessionSummaries';
import { http, HttpResponse } from 'msw';
import { ApiError, api } from '@/lib/api/client';
import type {
  CallBrief,
  ConsultationRange,
  ConsultationsData,
  ContactLog,
  CustomerData,
  CustomerInfo,
  HistoryPage,
  InfoSection,
  LeadQuery,
  LeadsData,
  NewLead,
  NewLeadAnswer,
  PaymentsData,
  PurchasesData,
} from '@/features/sales/api';
import type { NewTask, TaskChange } from '@/lib/tasks/api';
import { fetchConsultations } from './legacy/consultations';
import { fetchCustomer, fetchHistory, logContact } from './legacy/customer';
import { changeTask, createTask, taskRequest, tasksOverview } from './legacy/django';
import { fetchInfo, saveSection, UnknownNameError } from './legacy/info';
import { STAFF_API, type DjangoUser, type Page } from './djangoStaff';
import { createCustomer, fetchLeads } from './legacy/leads';
import { fetchPayments } from './legacy/payments';
import { fetchPurchases } from './legacy/purchases';
import { tagsOfCustomer } from './salesTags';
import { pageOf, storage } from './session';
import { overviewOf, taskListOf } from './tasks';

/**
 * The sales panel's endpoints (`/api/sales/v1/` S11–S22, `/api/staff/v1/tasks/` for sales staff),
 * computed from the rows of the fake staff API (src/mocks/staff.ts), as Django computes them from
 * its models. Each response is typed with the panel's own shape, so a change there shows here.
 */

const BASE = '/api/sales/v1';
const TASKS = '/api/staff/v1/tasks';
/** The mock sellers (src/mocks/handlers.ts): their tasks are StaffToDos about customers. */
const SELLERS = [3, 4];
/** Django's `CONSULTATIONS_PAGE` (api/sales/v1/seller.py). */
const CONSULTATIONS_PAGE = 20;
const isSeller = () => SELLERS.includes(storage.get() ?? 0);

/** The staff API's own error (403, 404, 400) answers as is. */
async function answer<T>(work: () => Promise<T>, status = 200) {
  try {
    const data: unknown = await work();
    return data === undefined
      ? new HttpResponse(null, { status: 204 })
      : HttpResponse.json(data as object, { status });
  } catch (error) {
    if (error instanceof ApiError)
      return HttpResponse.json(error.body as object, { status: error.status });
    throw error;
  }
}

const id = (params: Record<string, unknown>) => Number(params.id);
/** Reza (src/mocks/handlers.ts) manages sales; his seller filter lists the team. */
const MANAGER = 4;
const SELLER_NAME = 'نیما رستمی';
const MANAGER_TEAM = [
  { id: 8, name: SELLER_NAME },
  { id: 9, name: 'رضا کاظمی' },
];

export const salesStaffHandlers = [
  http.get(`${BASE}/leads/`, ({ request }) => {
    const query = new URL(request.url).searchParams;
    const leads: LeadQuery = {
      stage: (query.get('stage') ?? 'all') as LeadQuery['stage'],
      source: (query.get('source') ?? 'all') as LeadQuery['source'],
      band: (query.get('band') ?? 'all') as LeadQuery['band'],
      overdue: query.get('overdue') === '1',
      tag: query.get('tag') ? Number(query.get('tag')) : null,
      search: query.get('search') ?? '',
      page: Number(query.get('page') ?? 1),
    };
    // Each row's customer tags (S49); `?tag=` keeps the customers with it (on this page).
    return answer<LeadsData>(() =>
      fetchLeads(leads).then((data) => {
        // A sales manager's rows name their seller ('' nobody's yet); the legacy rows don't say whose,
        // so the mock gives every third one to nobody.
        const manager = storage.get() === MANAGER;
        const results = data.results
          .map((row) => ({
            ...row,
            tags: tagsOfCustomer(row.customer),
            ...(manager ? { seller: row.id % 3 === 0 ? '' : SELLER_NAME } : {}),
          }))
          .filter((row) => leads.tag === null || row.tags.includes(leads.tag));
        return {
          ...data,
          supports: { ...data.supports, tags: true },
          sellers: manager ? MANAGER_TEAM : [],
          ...(leads.tag === null ? {} : { count: results.length }),
          results,
        };
      }),
    );
  }),
  // S56: the customer picker's light search, best match first.
  http.get(`${BASE}/leads/search/`, ({ request }) => {
    const typed = (new URL(request.url).searchParams.get('q') ?? '').trim();
    if (typed.replace(/\s/g, '').length < 2) return HttpResponse.json({ results: [] });
    const all: LeadQuery = {
      stage: 'all',
      source: 'all',
      band: 'all',
      overdue: false,
      tag: null,
      search: typed,
      page: 1,
    };
    return answer(() =>
      fetchLeads(all).then((data) => ({
        results: data.results
          .filter((row) => ['new', 'contacted', 'consulted', 'offer'].includes(row.stage))
          .slice(0, 8)
          .map(({ id, customer, name, phone, stage, follow_up_at }) => ({
            id,
            customer,
            name,
            phone,
            stage,
            follow_up_at,
          })),
      })),
    );
  }),
  // S63: every customer, like the old CRM's search; the seller's own leads open, the rest are free.
  http.get(`${BASE}/customers/search/`, ({ request }) => {
    const typed = (new URL(request.url).searchParams.get('q') ?? '').trim();
    if (typed.replace(/\s/g, '').length < 2) return HttpResponse.json({ results: [] });
    return answer(async () => {
      const [users, mine] = await Promise.all([
        api<Page<DjangoUser>>(`${STAFF_API}/users/?search=${encodeURIComponent(typed)}`),
        fetchLeads({
          stage: 'all',
          source: 'all',
          band: 'all',
          overdue: false,
          search: '',
          page: 1,
        }),
      ]);
      const leads = new Map(mine.results.map((row) => [row.customer, row.stage]));
      return {
        results: users.results.slice(0, 10).map((user) => ({
          customer: user.id,
          name: `${user.first_name} ${user.last_name}`.trim(),
          phone: user.phone_number ?? '',
          email: user.email ?? '',
          access: storage.get() === MANAGER || leads.has(user.id) ? 'mine' : 'free',
          seller: null,
          stage: leads.get(user.id) ?? null,
        })),
      };
    });
  }),
  http.post(`${BASE}/customers/:id/take/`, ({ params }) =>
    isSeller()
      ? HttpResponse.json({ customer: id(params) })
      : HttpResponse.json({ detail: 'forbidden' }, { status: 403 }),
  ),
  http.post(`${BASE}/leads/`, async ({ request }) => {
    const lead = (await request.json()) as NewLead;
    let made: NewLeadAnswer;
    try {
      made = await createCustomer(lead);
    } catch (error) {
      if (error instanceof ApiError)
        return HttpResponse.json(error.body as object, { status: error.status });
      throw error;
    }
    return HttpResponse.json(made, { status: made.existing ? 200 : 201 });
  }),

  http.get(`${BASE}/consultations/`, ({ request }) => {
    const query = new URL(request.url).searchParams;
    const type = query.get('type');
    const range = (query.get('range') ?? 'today') as ConsultationRange;
    const date = query.get('date');
    return answer<ConsultationsData>(() =>
      fetchConsultations(
        range === 'day' ? 'all' : range,
        type ? Number(type) : null,
        query.get('unlogged') === '1',
      ).then((data) => {
        if (range !== 'day' || !date) {
          const { counts, ...rest } = data;
          return {
            ...rest,
            counts: date ? { ...counts, day: 0 } : counts,
            ...pageOf(request, data.results, CONSULTATIONS_PAGE),
          };
        }
        // One chosen day (S59): its sessions, counted by type; the mock logs no contacts.
        const results = data.results.filter((item) => item.starts_at.slice(0, 10) === date);
        const byType = new Map<string, number>();
        for (const item of results)
          byType.set(item.type.name, (byType.get(item.type.name) ?? 0) + 1);
        return {
          ...data,
          counts: { ...data.counts, day: results.length },
          day: {
            sessions: [...byType].map(([name, count]) => ({ type: name, count })),
            kinds: [],
            contacts: [],
            more: false,
          },
          ...pageOf(request, results, CONSULTATIONS_PAGE),
        };
      }),
    );
  }),

  http.get(`${BASE}/customers/:id/`, ({ params }) =>
    answer<CustomerData>(() =>
      fetchCustomer(id(params)).then((data) => ({
        ...data,
        tags: tagsOfCustomer(data.id),
        supports: { ...data.supports, tags: true, call_brief: true, summary_sms: false },
        attribution: { first_contact: null, won_by: null },
      })),
    ),
  ),
  // The call popup's "before you answer" box: the old site keeps none of it in one place.
  http.get(`${BASE}/customers/:id/call-brief/`, () =>
    HttpResponse.json<CallBrief>({
      last_contact: null,
      follow_up: null,
      unpaid: [],
      consultations_elsewhere: [],
    }),
  ),
  http.put(`${BASE}/customers/:id/second-phone/`, async ({ request }) => {
    const { phone } = (await request.json()) as { phone: string };
    return /^09\d{9}$/.test(phone)
      ? HttpResponse.json({ phone })
      : HttpResponse.json({ phone: ['invalid'] }, { status: 400 });
  }),
  http.get(`${BASE}/customers/:id/history/`, ({ params, request }) => {
    const page = Number(new URL(request.url).searchParams.get('page') ?? 1);
    return answer<HistoryPage>(async () => {
      const history = await fetchHistory(id(params), page);
      return {
        ...history,
        results: history.results.map((event) => ({
          ...event,
          customer_summary: summaryForContact(id(params), event.id) ?? '',
        })),
      };
    });
  }),
  http.post(`${BASE}/customers/:id/contacts/`, async ({ params, request }) => {
    const log = (await request.json()) as ContactLog;
    if (
      log.customer_summary.trim().length > 5000 ||
      (log.email_summary && !log.customer_summary.trim())
    )
      return HttpResponse.json(
        { customer_summary: ['Write a summary of up to 5,000 characters.'] },
        { status: 400 },
      );
    return answer(() => logContact(id(params), log).then(() => ({ id: 1 })), 201);
  }),
  http.get(`${BASE}/customers/:id/purchases/`, ({ params }) =>
    answer<PurchasesData>(() => fetchPurchases(id(params))),
  ),
  http.get(`${BASE}/customers/:id/payments/`, ({ params }) =>
    answer<PaymentsData>(() => fetchPayments(id(params))),
  ),
  http.get(`${BASE}/customers/:id/info/`, ({ params }) =>
    answer<CustomerInfo>(() => fetchInfo(id(params))),
  ),
  http.patch(`${BASE}/customers/:id/info/`, async ({ params, request }) => {
    const section = (await request.json()) as InfoSection;
    try {
      await saveSection(id(params), section);
    } catch (error) {
      // Django names the field it couldn't match (sales/v1/tabs.py).
      if (error instanceof UnknownNameError)
        return HttpResponse.json(
          section.goal
            ? { goal: { countries: [`Unknown countries: ${error.value}`] } }
            : {
                education: (section.education ?? []).map((row) =>
                  row.field === error.value ? { field: ['Unknown study field.'] } : {},
                ),
              },
          { status: 400 },
        );
      throw error;
    }
    return answer<CustomerInfo>(() => fetchInfo(id(params)));
  }),

  // Sellers' tasks; other staff fall through to src/mocks/tasks.ts.
  http.get(`${TASKS}/`, () =>
    isSeller() ? answer(() => tasksOverview().then(overviewOf)) : undefined,
  ),
  http.get(`${TASKS}/lists/:list/`, async ({ params, request }) =>
    isSeller() ? taskListOf(request, await tasksOverview(), String(params.list)) : undefined,
  ),
  http.get(`${TASKS}/:id/`, ({ params }) =>
    isSeller() ? answer(() => taskRequest(id(params))) : undefined,
  ),
  http.post(`${TASKS}/`, async ({ request }) => {
    if (!isSeller()) return undefined;
    const task = (await request.clone().json()) as NewTask;
    return answer(() => createTask(task).then(() => ({ id: 1 })), 201);
  }),
  http.post(`${TASKS}/:id/:action/`, async ({ params, request }) => {
    if (!isSeller() || ['remind', 'reassign'].includes(String(params.action))) return undefined;
    const kind = { comments: 'comment' }[String(params.action)] ?? String(params.action);
    const body = (await request
      .clone()
      .json()
      .catch(() => ({}))) as object;
    return answer(() =>
      changeTask(id(params), { kind, ...body } as TaskChange).then(() => undefined),
    );
  }),
];
