import { summaryForContact } from './sessionSummaries';
import { http, HttpResponse } from 'msw';
import { ApiError, api } from '@/lib/api/client';
import type {
  CallBrief,
  Consultation,
  ConsultationRange,
  ConsultationSummary,
  ConsultationTypeOption,
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
import type { NewTask, TaskChange, TaskSummary } from '@/lib/tasks/api';
import { fetchConsultations } from './legacy/consultations';
import { fetchCustomer, fetchHistory, logContact } from './legacy/customer';
import { customerPathwayCheck } from './pathways';
import { changeTask, createTask, taskRequest, tasksOverview } from './legacy/django';
import { fetchInfo, saveSection, UnknownNameError } from './legacy/info';
import { STAFF_API, type DjangoUser, type Page } from './djangoStaff';
import { createCustomer, fetchLeads } from './legacy/leads';
import { fetchPayments } from './legacy/payments';
import { fetchPurchases } from './legacy/purchases';
import { faceOf, putFace } from './face';
import {
  arrivalOf,
  customerInstalments,
  failed,
  listHolderOf,
  recordInstalmentReceipt,
  stateOrError,
  upcomingVisitOf,
} from './sales';
import { customerTemplates } from './messages';
import { tagsOfCustomer } from './salesTags';
import { forbidden, notFound, pageOf, storage } from './session';
import { canEditContactNote, contactNoteRow } from './staff';
import {
  colleaguesFound,
  overviewOf,
  penaltyRefused,
  summaryOf as tasksSummaryOf,
  taskListOf,
} from './tasks';

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

/**
 * S79: a meeting at the office ahead is the customer's follow-up. Django moves the follow-up task
 * to the meeting's time and names the meeting on it; the fake old site keeps neither.
 */
function withMeeting<
  T extends {
    id: number;
    name: string;
    tasks: TaskSummary[];
    lead: { follow_up_at: string | null; visit_at?: string | null } | null;
  },
>(data: T): T {
  const visit = upcomingVisitOf(data.id);
  if (!visit) return data;
  const index = data.tasks.findIndex((task) => task.kind === 'mine' && task.status !== 'done');
  const meeting = {
    id: index >= 0 ? (data.tasks[index]?.id ?? -visit.id) : -visit.id,
    kind: 'mine' as const,
    status: 'open' as const,
    text: `جلسه حضوری با ${data.name}`,
    due_at: visit.starts_at,
    timed: true,
    owner: null,
    creator: null,
    team: null,
    automatic: false,
    visit,
  };
  const tasks =
    index >= 0
      ? data.tasks.map((task, at) => (at === index ? { ...task, ...meeting } : task))
      : [meeting, ...data.tasks];
  return {
    ...data,
    tasks,
    lead: data.lead
      ? { ...data.lead, follow_up_at: visit.starts_at, visit_at: visit.starts_at }
      : data.lead,
  };
}

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

const DAY_MS = 86_400_000;
const localDay = (value: string | Date) => {
  const day = new Date(value);
  day.setHours(0, 0, 0, 0);
  return day.getTime();
};

/** Django's manager filters of `consultations/` (api/sales/v1/seller.py): span, mode, seller, status, q. */
function filterConsultations(rows: Consultation[], query: URLSearchParams) {
  const now = Date.now();
  const from = query.get('from');
  const to = query.get('to');
  const seller = query.get('seller');
  const typed = (query.get('q') ?? '').trim().toLowerCase();
  return rows.filter((item) => {
    const starts = new Date(item.starts_at).getTime();
    if (query.get('range') === 'span') {
      if (from && starts < localDay(`${from}T00:00:00`)) return false;
      if (to && starts >= localDay(`${to}T00:00:00`) + DAY_MS) return false;
    }
    const mode = query.get('mode');
    if (mode && item.mode !== mode) return false;
    if (seller === 'none' && item.seller_id !== null) return false;
    if (seller && seller !== 'none' && item.seller_id !== Number(seller)) return false;
    switch (query.get('status')) {
      case 'upcoming':
        if (starts < now) return false;
        break;
      case 'done':
        if (starts >= now || !item.logged) return false;
        break;
      case 'unlogged':
        if (starts >= now || item.logged) return false;
        break;
      case 'arrived':
        if (!item.arrived_at) return false;
        break;
    }
    return !typed || item.name.toLowerCase().includes(typed) || item.phone.includes(typed);
  });
}

/** The manager's cards: today, tomorrow, the next 7 days, upcoming with nobody, past without a log. */
function summaryOf(rows: Consultation[]): ConsultationSummary {
  const now = Date.now();
  const today = localDay(new Date());
  const within = (item: Consultation, days: number, skip = 0) => {
    const day = localDay(item.starts_at);
    return day >= today + skip * DAY_MS && day < today + days * DAY_MS;
  };
  const upcoming = (item: Consultation) => new Date(item.starts_at).getTime() >= now;
  return {
    today: rows.filter((item) => within(item, 1)).length,
    tomorrow: rows.filter((item) => within(item, 2, 1)).length,
    week: rows.filter((item) => within(item, 7)).length,
    unassigned: rows.filter((item) => upcoming(item) && item.seller_id === null).length,
    unlogged: rows.filter((item) => !upcoming(item) && !item.logged).length,
  };
}

/** The leads list's consultation types: the calendar mock's three (src/mocks/sales.ts) and an old one. */
const CONSULTATION_TYPES: ConsultationTypeOption[] = [
  { id: 1, name: 'مشاوره‌ی اپلای ارشد', mode: 'online', active: true },
  { id: 2, name: 'مشاوره‌ی اپلای دکتری', mode: 'online', active: true },
  { id: 3, name: 'مشاوره‌ی ویزای تحصیلی', mode: 'in_person', active: true },
  { id: 4, name: 'مشاوره‌ی حضوری قدیمی', mode: 'in_person', active: false },
];

/** What a mock customer bought: by their id, a quarter none, the rest one type each. */
function boughtType(customer: number): ConsultationTypeOption | null {
  const kind = customer % 4;
  return kind === 0 ? null : (CONSULTATION_TYPES[kind - 1] ?? null);
}

/** Whether a customer passes `?consultation=` and `?consultation_type=`, as Django filters them. */
function consultationMatches(customer: number, mode: string | null, typeId: number | null) {
  const type = boughtType(customer);
  if (mode === 'none') return type === null;
  if (type === null) return !mode || mode === 'all' ? typeId === null : false;
  if (mode === 'in_person' || mode === 'online') {
    if (type.mode !== mode) return false;
  }
  return typeId === null || type.id === typeId;
}

function columnsOf(): NonNullable<CustomerData['columns']> {
  const data = stateOrError();
  return failed(data)
    ? []
    : data.stages.map(({ id, name, phase, activities }) => ({ id, name, phase, activities }));
}

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
    const consultation = query.get('consultation');
    const consultationType = query.get('consultation_type')
      ? Number(query.get('consultation_type'))
      : null;
    const consulted = (consultation && consultation !== 'all') || consultationType !== null;
    // Open leads with no next step (no follow-up), the first call made: a log can end it on purpose.
    const noFollowUp = query.get('no_follow_up') === '1';
    const idle = (row: { stage: string; follow_up_at: string | null }) =>
      ['contacted', 'consulted', 'offer'].includes(row.stage) && row.follow_up_at === null;
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
            face: faceOf(row.customer),
            ...(manager ? { seller: row.id % 3 === 0 ? '' : SELLER_NAME } : {}),
          }))
          .filter((row) => leads.tag === null || row.tags.includes(leads.tag))
          .filter((row) => consultationMatches(row.customer, consultation, consultationType))
          .filter((row) => !noFollowUp || idle(row));
        return {
          ...data,
          supports: { ...data.supports, tags: true, consultations: true, no_follow_up: true },
          stats: { ...data.stats, no_follow_up: data.results.filter(idle).length },
          sellers: manager ? MANAGER_TEAM : [],
          consultation_types: CONSULTATION_TYPES,
          ...(leads.tag === null && !consulted && !noFollowUp ? {} : { count: results.length }),
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
  // S63: every customer, like the old CRM's search; any of them opens (the seller's own or not).
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
    const range = (query.get('range') ?? 'today') as ConsultationRange | 'span';
    const date = query.get('date');
    const manager = storage.get() === MANAGER;
    return answer<ConsultationsData>(() =>
      fetchConsultations(
        range === 'day' || range === 'span' ? 'all' : range,
        type ? Number(type) : null,
        query.get('unlogged') === '1',
      ).then((data) => {
        // Who holds each one and when an in-person customer came, as the calendar mock keeps them.
        const rows: Consultation[] = data.results.map((item) => ({
          ...item,
          ...listHolderOf(item.id),
          arrived_at: arrivalOf(item.id),
        }));
        const shared = {
          types: data.types,
          unlogged: data.unlogged,
          sellers: manager ? MANAGER_TEAM : [],
          ...(manager ? { summary: summaryOf(rows) } : {}),
        };
        if (range !== 'day' || !date) {
          const results = filterConsultations(rows, query);
          return {
            ...shared,
            counts: date ? { ...data.counts, day: 0 } : data.counts,
            ...pageOf(request, results, CONSULTATIONS_PAGE),
          };
        }
        // One chosen day (S59): its sessions, counted by type; the mock logs no contacts.
        const results = rows.filter((item) => item.starts_at.slice(0, 10) === date);
        const byType = new Map<string, number>();
        for (const item of results)
          byType.set(item.type.name, (byType.get(item.type.name) ?? 0) + 1);
        return {
          ...shared,
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
        ...withMeeting(data),
        tags: tagsOfCustomer(data.id),
        face: faceOf(data.id),
        templates: customerTemplates(data.name),
        // The board's team columns (S48), as the board mock keeps them.
        columns: columnsOf(),
        supports: {
          ...data.supports,
          tags: true,
          call_brief: true,
          summary_sms: false,
          columns: true,
          no_answer_send: true,
        },
        attribution: { first_contact: null, won_by: null },
        pathway_check: customerPathwayCheck(data.id),
        // conf/notifications.json's crm_unanswered_call, with the customer's first name.
        no_answer_sms_text: `سلام ${data.name.split(' ')[0] ?? ''} عزیز\nمتأسفانه مشاوران اسکورایز موفق به تماس با شما نشدند، لطفا جهت ارتباط با موسسه با شماره زیرتماس بگیرید.\n\nتیم اسکورایز - ۰۲۱۹۱۰۱۸۴۵7`,
        tablet_share_url: 'https://scorize.com/panel/background',
      })),
    ),
  ),
  // The customer's emoji and color (S66): the same one the supervisor mock shows on the case.
  http.put(`${BASE}/customers/:id/face/`, ({ params, request }) => putFace(id(params), request)),
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
  http.get(`${BASE}/customers/:id/recordings/`, () => HttpResponse.json({ results: [] })),
  http.get(`${BASE}/customers/:id/history/`, ({ params, request }) => {
    const query = new URL(request.url).searchParams;
    const page = Number(query.get('page') ?? 1);
    // S78: every typed word in the event's own text.
    const words = (query.get('q') ?? '').trim().toLowerCase().split(/\s+/).filter(Boolean);
    return answer<HistoryPage>(async () => {
      const history = await fetchHistory(id(params), page);
      const results = history.results.map((event) => {
        const contact = event.id.startsWith('contact-')
          ? contactNoteRow(id(params), Number(event.id.slice('contact-'.length)))
          : undefined;
        return {
          ...event,
          customer_summary: summaryForContact(id(params), event.id) ?? '',
          ...(contact && canEditContactNote(contact)
            ? { contact_edit: { id: contact.id, version: contact.notes ?? '' } }
            : {}),
        };
      });
      if (words.length === 0) return { ...history, results };
      return {
        ...history,
        results: results.filter((event) =>
          words.every((word) =>
            [event.text, event.customer_summary, event.title ?? ''].some((text) =>
              text.toLowerCase().includes(word),
            ),
          ),
        ),
      };
    });
  }),
  http.get(`${BASE}/customers/:id/contacts/:contact/`, ({ params }) => {
    const contact = contactNoteRow(id(params), Number(params.contact));
    if (!contact) return notFound();
    if (!canEditContactNote(contact)) return forbidden();
    return HttpResponse.json({ notes: contact.notes ?? '', version: contact.notes ?? '' });
  }),
  http.patch(`${BASE}/customers/:id/contacts/:contact/`, async ({ params, request }) => {
    const contact = contactNoteRow(id(params), Number(params.contact));
    if (!contact) return notFound();
    if (!canEditContactNote(contact)) return forbidden();
    const body = (await request.json()) as { notes?: unknown; version?: unknown };
    if (typeof body.notes !== 'string' || Array.from(body.notes.trim()).length > 5000)
      return HttpResponse.json({ notes: ['Enter up to 5,000 characters.'] }, { status: 400 });
    if (typeof body.version !== 'string')
      return HttpResponse.json({ version: ['This field is required.'] }, { status: 400 });
    if (body.version !== (contact.notes ?? ''))
      return HttpResponse.json({ code: 'contact_note_changed' }, { status: 409 });
    const notes = body.notes.trim();
    contact.notes = notes || null;
    return HttpResponse.json({ notes, version: notes });
  }),
  http.post(`${BASE}/customers/:id/contacts/`, async ({ params, request }) => {
    const log = (await request.json()) as ContactLog;
    // S79: a meeting at the office ahead stays the next step; a lost lead must cancel it first.
    if (log.stage === 'lost' && upcomingVisitOf(id(params)))
      return HttpResponse.json(
        { detail: 'This customer has a meeting at the office ahead.', code: 'visit' },
        { status: 409 },
      );
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
  http.get(`${BASE}/customers/:id/payments/`, ({ params }) => {
    const data = stateOrError();
    if (failed(data)) return data;
    return answer<PaymentsData>(async () => ({
      ...(await fetchPayments(id(params))),
      instalments: customerInstalments(data, id(params)),
      // Nima is a plain seller: a receipt he records waits for review.
      confirms_receipts: false,
    }));
  }),
  http.post(`${BASE}/instalments/:id/receipt/`, async ({ params, request }) => {
    const data = stateOrError();
    if (failed(data)) return data;
    const receipt = (await request.formData()).get('receipt');
    if (
      !(receipt instanceof File) ||
      receipt.size > 10 * 1024 * 1024 ||
      !['application/pdf', 'image/jpeg', 'image/png'].includes(receipt.type)
    )
      return HttpResponse.json({ receipt: ['invalid'] }, { status: 400 });
    const result = recordInstalmentReceipt(data, id(params), false);
    if (result === 404) return notFound();
    if (result === 409)
      return HttpResponse.json(
        { detail: 'A receipt of this instalment is waiting for review.', code: 'in_review' },
        { status: 409 },
      );
    return HttpResponse.json(result, { status: 201 });
  }),
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
  http.get(`${TASKS}/summary/`, async () =>
    isSeller() ? HttpResponse.json(tasksSummaryOf(await tasksOverview())) : undefined,
  ),
  // Not a task's id: the colleague search is the same for everyone (src/mocks/tasks.ts).
  http.get(`${TASKS}/colleagues/`, ({ request }) => colleaguesFound(request)),
  http.get(`${TASKS}/:id/`, ({ params }) =>
    isSeller() ? answer(() => taskRequest(id(params))) : undefined,
  ),
  http.post(`${TASKS}/`, async ({ request }) => {
    if (!isSeller()) return undefined;
    const task = (await request.clone().json()) as NewTask;
    return penaltyRefused(task) ?? answer(() => createTask(task).then(() => ({ id: 1 })), 201);
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
