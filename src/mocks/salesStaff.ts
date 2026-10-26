import { summaryForContact } from './sessionSummaries';
import { http, HttpResponse } from 'msw';
import { ApiError } from '@/lib/api/client';
import type {
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
  PaymentsData,
  PurchasesData,
} from '@/features/sales/api';
import type { NewTask, TaskChange } from '@/lib/tasks/api';
import { fetchConsultations } from './legacy/consultations';
import { fetchCustomer, fetchHistory, logContact } from './legacy/customer';
import { changeTask, createTask, taskRequest, tasksOverview } from './legacy/django';
import { fetchInfo, saveSection, UnknownNameError } from './legacy/info';
import { createCustomer, fetchLeads } from './legacy/leads';
import { fetchPayments } from './legacy/payments';
import { fetchPurchases } from './legacy/purchases';
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

export const salesStaffHandlers = [
  http.get(`${BASE}/leads/`, ({ request }) => {
    const query = new URL(request.url).searchParams;
    const leads: LeadQuery = {
      stage: (query.get('stage') ?? 'all') as LeadQuery['stage'],
      source: (query.get('source') ?? 'all') as LeadQuery['source'],
      band: (query.get('band') ?? 'all') as LeadQuery['band'],
      overdue: query.get('overdue') === '1',
      search: query.get('search') ?? '',
      page: Number(query.get('page') ?? 1),
    };
    return answer<LeadsData>(() => fetchLeads(leads));
  }),
  http.post(`${BASE}/leads/`, async ({ request }) => {
    const lead = (await request.json()) as NewLead;
    return answer(() => createCustomer(lead), 201);
  }),

  http.get(`${BASE}/consultations/`, ({ request }) => {
    const query = new URL(request.url).searchParams;
    const type = query.get('type');
    return answer<ConsultationsData>(() =>
      fetchConsultations(
        (query.get('range') ?? 'today') as ConsultationRange,
        type ? Number(type) : null,
        query.get('unlogged') === '1',
      ).then((data) => ({ ...data, ...pageOf(request, data.results, CONSULTATIONS_PAGE) })),
    );
  }),

  http.get(`${BASE}/customers/:id/`, ({ params }) =>
    answer<CustomerData>(() => fetchCustomer(id(params))),
  ),
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
      (log.customer_summary ?? '').trim().length > 5000 ||
      (log.email_summary && !log.customer_summary?.trim())
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
