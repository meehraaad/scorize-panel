import { http, HttpResponse } from 'msw';
import type { Offer, StandardClause } from '@/features/sales/api';
import { fillText } from '@/lib/contractText';
import { mergedText, valuesOf } from './contractText';
import type {
  Agreement,
  AgreementClause,
  AgreementParty,
  AgreementRemark,
} from '@/lib/agreement/api';
import { storage } from './session';

/**
 * The contract agreement desk (S62) as Django keeps it (`api/sales/v1/agreement.py`): a version
 * each time the seller sends or submits a text that reads differently, each party's agreement on
 * a version, and the remarks. The sales mock records versions (`recordVersion`); the customer's
 * side is a separate fake offer for Maryam, the applicant mock's user without a contract.
 */
interface Version {
  number: number;
  lines: { key: string; value: string }[];
  clauses: Omit<AgreementClause, 'since_previous' | 'previous_text'>[];
  amount: number;
  created_at: string;
  agreed: Partial<Record<AgreementParty, string>>;
}

interface Desk {
  state: string;
  seller: string;
  consultant: string | null;
  customer: string;
  versions: Version[];
  remarks: AgreementRemark[];
}

let desks: Map<number, Desk> | null = null;
let nextRemark = 700;
const MARYAM = 2;
const MARYAM_DESK = -MARYAM;

const ago = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();

function seedMaryam(): Desk {
  const base = 'اسکورایز برای متقاضی ۶ اپلای انجام می‌دهد.';
  const promise = {
    title: 'تعهدات اسکورایز',
    text: 'اسکورایز برای متقاضی ۸ اپلای در کانادا و آلمان انجام می‌دهد.',
    change: 'changed' as const,
    base_text: base,
  };
  const cancel = {
    title: 'فسخ',
    text: 'تا ۷ روز بعد از امضا، فسخ با بازگشت کامل مبلغ.',
    change: null,
    base_text: null,
  };
  const clauses = [promise, cancel];
  const lines = [
    { key: 'services', value: 'خدمات پذیرش' },
    { key: 'countries', value: 'کانادا، آلمان' },
    { key: 'applies', value: '8' },
    { key: 'amount', value: '۶۶٬۵۰۰٬۰۰۰ تومان' },
  ];
  return {
    state: 'sent',
    seller: 'نیما رستمی',
    consultant: 'کاوه نوری',
    customer: 'مریم کاظمی',
    versions: [
      {
        number: 1,
        lines: lines.map((line) => (line.key === 'applies' ? { ...line, value: '6' } : line)),
        clauses: [{ ...promise, text: base, change: null, base_text: null }, cancel],
        amount: 66_500_000,
        created_at: ago(30),
        agreed: { seller: ago(30) },
      },
      {
        number: 2,
        lines,
        clauses,
        amount: 66_500_000,
        created_at: ago(4),
        agreed: { seller: ago(4), consultant: ago(2) },
      },
    ],
    remarks: [],
  };
}

/** The version on the table; a desk always has one. */
function latest(desk: Desk): Version {
  const version = desk.versions.at(-1);
  if (!version) throw new Error('A desk without a version.');
  return version;
}

function all() {
  desks ??= new Map([[MARYAM_DESK, seedMaryam()]]);
  return desks;
}

const PARTIES: AgreementParty[] = ['seller', 'consultant', 'manager', 'customer'];

function view(desk: Desk, you: AgreementParty | null, customerOnly: boolean): Agreement {
  const current = latest(desk);
  const previous = desk.versions.at(-2);
  const names: Record<AgreementParty, string> = {
    seller: desk.seller,
    consultant: desk.consultant ?? '',
    manager: '',
    customer: desk.customer,
  };
  const parties = PARTIES.filter((party) => party !== 'consultant' || desk.consultant).map(
    (party) => ({ party, name: names[party], agreed_at: current.agreed[party] ?? null }),
  );
  const before = new Map(previous?.lines.map((line) => [line.key, line.value]));
  const oldText = new Map(previous?.clauses.map((clause) => [clause.title, clause.text]));
  const remarks = desk.remarks.filter((remark) => !customerOnly || remark.party === 'customer');
  return {
    state: desk.state,
    version: current.number,
    amount: current.amount,
    versions: desk.versions.map((version) => ({
      number: version.number,
      created_at: version.created_at,
      author: desk.seller,
    })),
    parties,
    you,
    agreed: parties.every((row) => row.agreed_at),
    lines: current.lines.map((line) => ({
      ...line,
      previous:
        previous && before.get(line.key) !== line.value ? (before.get(line.key) ?? null) : null,
    })),
    clauses: current.clauses.map((clause) => {
      const old = oldText.get(clause.title);
      return {
        ...clause,
        since_previous: previous !== undefined && old !== clause.text,
        previous_text: previous && old !== undefined && old !== clause.text ? old : null,
      };
    }),
    remarks,
    open_remarks: remarks.filter((r) => r.version === current.number && !r.answered_at).length,
  };
}

/** The sales mock calls this when the seller sends or submits an offer. */
export function recordVersion(
  customer: { id: number; name: string },
  offer: Offer,
  amount: number,
  state: 'sent' | 'submitted',
  standard: StandardClause[],
) {
  const desk = all().get(customer.id) ?? {
    state,
    seller: 'نیما رستمی',
    consultant: null,
    customer: customer.name,
    versions: [],
    remarks: [],
  };
  desk.state = state;
  // Django's `clauses_of` (S69): keyed, in place, variables filled.
  const values = valuesOf(customer.name, amount, offer.variables);
  const clauses = mergedText(standard, offer.clauses).map((row) => ({
    ...row,
    text: fillText(row.text, values),
    base_text: row.base_text === null ? null : fillText(row.base_text, values),
  }));
  const lines = [
    { key: 'countries', value: offer.countries.join('، ') },
    { key: 'applies', value: String(offer.applies) },
    { key: 'amount', value: String(amount) },
  ];
  const last = desk.versions.at(-1);
  if (!last || JSON.stringify([last.lines, last.clauses]) !== JSON.stringify([lines, clauses]))
    desk.versions.push({
      number: (last?.number ?? 0) + 1,
      lines,
      clauses,
      amount,
      created_at: new Date().toISOString(),
      agreed: { seller: new Date().toISOString() },
    });
  all().set(customer.id, desk);
}

const SALES = '/api/sales/v1';
const APPLICANT = '/api/applicant/v1';
const SELLERS = new Set([3, 4]);
const MANAGER = 4;

const stale = () =>
  HttpResponse.json({ detail: 'The offer changed meanwhile.', code: 'stale' }, { status: 409 });

async function addRemark(desk: Desk, party: AgreementParty, author: string, request: Request) {
  const body = (await request.json()) as { version: number; clause?: string; text: string };
  const current = latest(desk);
  if (body.version !== current.number) return stale();
  desk.remarks.push({
    id: (nextRemark += 1),
    version: current.number,
    clause: body.clause?.trim() || null,
    party,
    author,
    text: body.text.trim(),
    created_at: new Date().toISOString(),
    answer: null,
    answered_at: null,
  });
  return HttpResponse.json({ id: nextRemark }, { status: 201 });
}

export const agreementHandlers = [
  http.get(`${SALES}/customers/:id/agreement/`, ({ params }) => {
    const user = storage.get();
    if (!user || !SELLERS.has(user)) return HttpResponse.json({}, { status: 403 });
    const desk = all().get(Number(params.id));
    return HttpResponse.json({
      agreement: desk ? view(desk, user === MANAGER ? 'manager' : 'seller', false) : null,
    });
  }),
  http.post(
    `${SALES}/customers/:id/agreement/remarks/:remark/answer/`,
    async ({ params, request }) => {
      const desk = all().get(Number(params.id));
      const remark = desk?.remarks.find((item) => item.id === Number(params.remark));
      if (!remark) return HttpResponse.json({}, { status: 404 });
      remark.answer = ((await request.json()) as { text: string }).text.trim();
      remark.answered_at = new Date().toISOString();
      return new HttpResponse(null, { status: 204 });
    },
  ),
  http.post(`${SALES}/customers/:id/agreement/remarks/`, ({ params, request }) => {
    const desk = all().get(Number(params.id));
    if (!desk) return HttpResponse.json({}, { status: 409 });
    return addRemark(desk, 'seller', desk.seller, request);
  }),

  // The customer's side.
  http.get(`${APPLICANT}/offer/`, () => {
    const desk = storage.get() === MARYAM ? all().get(MARYAM_DESK) : undefined;
    return HttpResponse.json({ agreement: desk ? view(desk, 'customer', true) : null });
  }),
  http.post(`${APPLICANT}/offer/remarks/`, ({ request }) => {
    const desk = storage.get() === MARYAM ? all().get(MARYAM_DESK) : undefined;
    if (!desk) return HttpResponse.json({ code: 'not_open' }, { status: 409 });
    return addRemark(desk, 'customer', desk.customer, request);
  }),
  http.post(`${APPLICANT}/offer/agree/`, async ({ request }) => {
    const desk = storage.get() === MARYAM ? all().get(MARYAM_DESK) : undefined;
    if (!desk) return HttpResponse.json({ code: 'not_open' }, { status: 409 });
    const { version } = (await request.json()) as { version: number };
    const current = latest(desk);
    if (version !== current.number) return stale();
    if (
      desk.remarks.some(
        (remark) =>
          remark.party === 'customer' && remark.version === version && !remark.answered_at,
      )
    )
      return HttpResponse.json({ code: 'open_remarks' }, { status: 409 });
    current.agreed.customer = new Date().toISOString();
    return new HttpResponse(null, { status: 204 });
  }),
];

/** Test helper: answer the customer's open remarks as the seller would. */
export function answerCustomerRemarks(text: string) {
  for (const remark of all().get(MARYAM_DESK)?.remarks ?? []) {
    remark.answer ??= text;
    remark.answered_at ??= new Date().toISOString();
  }
}

export function resetAgreementMocks() {
  desks = null;
}
