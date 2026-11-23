import { http, HttpResponse } from 'msw';
import { storage } from './session';

const api = '/api/executive/v1';
const customer = {
  id: 1240,
  name: 'سارا محمدی',
  items: [
    { id: 124000, kind: 'admission', name: 'پذیرش', detail: 'آلمان', status: 'open', case: 1240 },
    { id: 1240, kind: 'writing', name: 'sop', detail: null, status: 'new', case: null },
  ],
};

const customerCases = [
  {
    id: 1240,
    name: customer.name,
    case_id: 1240,
    file_number: 1240,
    contract: 'دکترای کانادا',
    services: [
      { id: 124000, name: 'پذیرش کانادا', owner: { name: 'مریم کاظمی', mine: true } },
      { id: 124001, name: 'ویزا', owner: null },
    ],
    stage: 'applying',
    next_task: { title: 'بررسی برنامه‌ها', due_at: '2026-11-24T14:30:00Z', urgency: 'today' },
    docs: { uploaded: 9, required: 14, review: 2 },
    email: 'on',
    last_activity: '2026-11-24T10:30:00Z',
  },
  {
    id: 1218,
    name: 'امید رضوانی',
    case_id: 1218,
    file_number: 1218,
    contract: 'ارشد آلمان',
    services: [{ id: 121800, name: 'پذیرش آلمان', owner: { name: 'علی نوری', mine: false } }],
    stage: 'documents',
    next_task: null,
    docs: { uploaded: 4, required: 10, review: 0 },
    email: null,
    last_activity: null,
  },
];

const forStaff = (body: object) =>
  storage.get() === 2 ? HttpResponse.json(body) : new HttpResponse(null, { status: 403 });

export const executiveHandlers = [
  http.get(`${api}/overview/`, () =>
    forStaff({
      services: [
        { key: 'admission', name: 'پذیرش', active: 1, total: 1 },
        { key: 'writing', name: null, active: 1, total: 1 },
      ],
      writing_waiting: 1,
    }),
  ),
  http.get(`${api}/work/`, ({ request }) => {
    const search = new URL(request.url).searchParams;
    const service = search.get('service');
    const userId = search.get('customer');
    const items = customer.items.filter((item) => !service || item.kind === service);
    const results =
      items.length && (!userId || userId === String(customer.id)) ? [{ ...customer, items }] : [];
    return forStaff({ count: results.length, page_size: 20, results });
  }),
  http.get(`${api}/customers/`, ({ request }) => {
    const params = new URL(request.url).searchParams;
    const scope = params.get('scope');
    const queue = params.get('queue');
    const search = params.get('search');
    const rows = customerCases.filter(
      (row) =>
        (scope !== 'mine' || row.id === 1240) &&
        (!queue || (queue === 'today' && row.id === 1240)) &&
        (!search || row.name.includes(search) || String(row.file_number).includes(search)),
    );
    const page = Number(params.get('page') ?? 1);
    return forStaff({
      scopes: { mine: 1, team: 2, all: 2 },
      queues: { today: 1, late: 0, review: 1, reply: 0, unassigned: 1 },
      options: {
        country: [
          { value: 'CA', label: 'کانادا' },
          { value: 'DE', label: 'آلمان' },
        ],
        contract: [
          { value: 'phd', label: 'دکترا' },
          { value: 'masters', label: 'ارشد' },
        ],
        service: [{ value: 'admission', label: 'پذیرش' }],
      },
      can_export: true,
      can_import: true,
      count: rows.length,
      page_size: 1,
      results: rows.slice(page - 1, page),
    });
  }),
  http.post(`${api}/customers/import/preview/`, () =>
    forStaff({ token: 'customer-preview', ready: 1, skipped: 1 }),
  ),
  http.post(`${api}/customers/import/`, () => forStaff({ updated: 1 })),
  http.get(`${api}/tickets/:department/`, ({ params }) => {
    const writing = params.department === 'writing';
    const last = {
      text: writing ? 'پرسش درباره انگیزه‌نامه' : 'پرسش درباره پذیرش',
      at: new Date().toISOString(),
      author: customer.name,
      mine: false,
    };
    return forStaff({
      count: 1,
      page_size: 20,
      counts: { waiting: 1, all: 1 },
      results: [
        {
          applicant: { id: 1240, name: customer.name, file_number: 1240 },
          last,
          unread: 1,
          waiting_since: last.at,
          urgent: false,
          thread: writing ? 'writing/sop' : 'service/124000',
          ...(!writing && { thread_name: 'پذیرش' }),
        },
      ],
    });
  }),
];
