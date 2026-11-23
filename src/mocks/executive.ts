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
