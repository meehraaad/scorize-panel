import { http, HttpResponse } from 'msw';
import type { ContractState } from '@/panels/executive/customer/api';
import { fetchInfo } from './legacy/info';
import { mockCase } from './supervisor';
import { storage } from './session';

const api = '/api/executive/v1';

const CUSTOMER_NAME = 'سارا محمدی';

const customerCases = [
  {
    id: 1240,
    name: 'سارا محمدی',
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

const contractStates = new Map<number, ContractState>();
export const resetExecutiveMocks = () => contractStates.clear();

export const executiveHandlers = [
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
        service: [
          { value: 'admission', label: 'پذیرش' },
          { value: 'writing', label: 'نگارش' },
        ],
        writing: [
          { value: 'sop', label: 'SOP' },
          { value: 'cv', label: 'CV' },
        ],
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
  http.get(`${api}/customers/:id/workspace/`, ({ params }) => {
    const id = Number(params.id);
    const file = mockCase(id);
    if (!file) return new HttpResponse(null, { status: 404 });
    const services = file.services ?? [];
    return forStaff({
      id,
      name: file.name,
      case: file,
      services,
      service_tabs: services.map((entry) => entry.id),
      writing: id === 1240 ? [{ id: 1240, kind: 'sop', state: 'new' }] : [],
      open_tasks: 1,
      next_task: {
        id: 123,
        text: 'Review the documents',
        due_at: '2026-11-24T14:30:00Z',
        status: 'open',
        done_at: null,
        can_complete: true,
      },
      contract_state: contractStates.get(id) ?? { status: 'accepted', termination_reason: null },
      can_change_contract: true,
      can_edit_information: true,
    });
  }),
  http.get(`${api}/customers/:id/tasks/`, ({ request }) => {
    const done = new URL(request.url).searchParams.get('state') === 'completed';
    return forStaff({
      count: 1,
      page_size: 15,
      open: 1,
      completed: 1,
      results: [
        {
          id: done ? 124 : 123,
          text: done ? 'Saved the contract' : 'Review the documents',
          due_at: '2026-11-24T14:30:00Z',
          status: done ? 'done' : 'open',
          done_at: done ? '2026-11-24T14:30:00Z' : null,
          can_complete: !done,
        },
      ],
    });
  }),
  http.get(`${api}/customers/:id/information/`, async () => forStaff(await fetchInfo(105))),
  http.get(`${api}/customers/:id/finance/`, () => forStaff({ payments: [], purchases: [] })),
  http.get(`${api}/customers/:id/report/`, () =>
    forStaff({ services: [], answered: 0, waiting: 0, slow: 0 }),
  ),
  http.patch(`${api}/customers/:id/contract-status/`, async ({ params, request }) => {
    const state = (await request.json()) as ContractState;
    contractStates.set(Number(params.id), state);
    return forStaff(state);
  }),
  http.get(`${api}/tickets/:department/`, ({ params }) => {
    const writing = params.department === 'writing';
    const last = {
      text: writing ? 'پرسش درباره انگیزه‌نامه' : 'پرسش درباره پذیرش',
      at: new Date().toISOString(),
      author: CUSTOMER_NAME,
      mine: false,
    };
    return forStaff({
      count: 1,
      page_size: 20,
      counts: { waiting: 1, all: 1 },
      results: [
        {
          applicant: { id: 1240, name: CUSTOMER_NAME, file_number: 1240 },
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
