import { http, HttpResponse } from 'msw';
import type { HandoffContract } from '@/features/sales/api';
import type { HandoffCase, HandoffSupervisor } from '@/features/supervisor/api';
import { ERFAN, failed, stateOrError } from './sales';
import { forbidden, notFound, storage } from './session';
import { SUPERVISOR } from './supervisor';

/**
 * Fake contract handoff (docs/backend-changes.md S43–S45, SV18, SV19), shared by the seller's
 * customer page and the supervisor panel's new cases: approving an offer (src/mocks/salesManager.ts)
 * opens one here, as Django's `open_case` does.
 */

const SALES = '/api/sales/v1';
const SUPERVISOR_API = '/api/supervisor/v1';
const HOUR = 3_600_000;
const hoursAgo = (hours: number) => new Date(Date.now() - hours * HOUR).toISOString();
const FIRST_SHARE = 0.4;
const ROUND = 100_000;

interface MockHandoff {
  contract: HandoffContract;
  /** The customer's user id (the sales customer page). */
  customer: number;
  row: Omit<HandoffCase, 'case' | 'state' | 'scans' | 'prepayment'>;
}

const SUPERVISORS: HandoffSupervisor[] = [
  { id: 7, name: 'مریم کاظمی', active: 18, countries: ['کانادا', 'آلمان'] },
  { id: 11, name: 'علی نوری', active: 12, countries: ['ایتالیا'] },
  { id: 12, name: 'سحر امینی', active: 9, countries: [] },
];

let nextId = 700;

function handoff(
  customer: number,
  name: string,
  amount: number,
  countries: string[],
  extra: Partial<HandoffContract> = {},
): MockHandoff {
  nextId += 1;
  return {
    customer,
    contract: {
      id: nextId,
      case: nextId + 1000,
      state: 'signing',
      scans: [],
      prepayment: {
        payment_id: nextId + 2000,
        amount: Math.round((amount * FIRST_SHARE) / ROUND) * ROUND,
        status: 'unpaid',
      },
      instalments: 3,
      supervisors: [],
      ...extra,
    },
    row: {
      name,
      phone: '09121230000',
      seller: 'نیما رستمی',
      approved_at: hoursAgo(5),
      features: ['admission'],
      countries,
      degrees: [2],
      amount,
      suggested:
        SUPERVISORS.find((person) => person.countries.some((c) => countries.includes(c)))?.id ?? 12,
    },
  };
}

const seed = (): Map<number, MockHandoff> =>
  new Map(
    [
      // The seller's customer whose first instalment was just paid: still to sign on paper.
      handoff(112, 'کیان مرادی', 120_000_000, ['ایتالیا']),
      // Signed and prepaid: ready for a supervisor.
      handoff(ERFAN + 900, 'آرمان صادقی', 95_000_000, ['آلمان'], {
        state: 'supervisor',
        scans: [{ id: 1, url: '/media/applicant-contracts/signed.pdf', uploaded_at: hoursAgo(3) }],
        prepayment: { payment_id: 3001, amount: 38_000_000, status: 'paid' },
      }),
    ].map((item) => [item.customer, item]),
  );

let handoffs: Map<number, MockHandoff> | null = null;
const all = () => (handoffs ??= seed());

/** Django's `open_case` on approval: the case file, instalments and the prepayment. */
export function openHandoff(customer: number, name: string, amount: number, countries: string[]) {
  all().set(customer, handoff(customer, name, amount, countries));
}

export function resetHandoffMocks() {
  handoffs = null;
  nextId = 700;
}

/** Signed and paid: the manager can assign; the state the server derives. */
function refresh(item: MockHandoff) {
  const { contract } = item;
  if (contract.state === 'active') return;
  const paid = contract.prepayment?.status === 'paid';
  contract.state = !contract.scans.length ? 'signing' : paid ? 'supervisor' : 'payment';
}

/** Mock test helper: the customer paid the prepayment. */
export function payHandoff(customer: number) {
  const item = all().get(customer);
  if (item?.contract.prepayment) {
    item.contract.prepayment.status = 'paid';
    refresh(item);
  }
}

const canAssign = () => storage.get() === SUPERVISOR;

export const handoffHandlers = [
  http.get(`${SALES}/customers/:id/contract/`, ({ params }) => {
    const data = stateOrError();
    if (failed(data)) return data;
    return HttpResponse.json({ contract: all().get(Number(params.id))?.contract ?? null });
  }),

  http.post(`${SALES}/customers/:id/contract/scan/`, async ({ params, request }) => {
    const data = stateOrError();
    if (failed(data)) return data;
    const item = all().get(Number(params.id));
    if (!item) return HttpResponse.json({ detail: 'No approved contract.' }, { status: 409 });
    if (item.contract.state === 'active')
      return HttpResponse.json({ detail: 'The case has already started.' }, { status: 409 });
    const file = (await request.formData()).get('file');
    if (!(file instanceof File)) return HttpResponse.json({ file: ['required'] }, { status: 400 });
    const id = item.contract.scans.length + 1;
    item.contract.scans.push({
      id,
      url: `/media/applicant-contracts/${file.name}`,
      uploaded_at: new Date().toISOString(),
    });
    refresh(item);
    return HttpResponse.json({ id }, { status: 201 });
  }),

  http.get(`${SUPERVISOR_API}/handoffs/`, () => {
    if (!canAssign()) return forbidden();
    const results: HandoffCase[] = [...all().values()]
      .filter((item) => item.contract.state !== 'active')
      .map(({ contract, row }) => ({
        ...row,
        case: contract.case,
        state: contract.state as HandoffCase['state'],
        scans: contract.scans,
        prepayment: contract.prepayment,
      }));
    return HttpResponse.json({ results, supervisors: SUPERVISORS });
  }),

  http.post(`${SUPERVISOR_API}/handoffs/:id/`, async ({ params, request }) => {
    if (!canAssign()) return forbidden();
    const item = [...all().values()].find(
      (entry) => entry.contract.case === Number(params.id) && entry.contract.state !== 'active',
    );
    if (!item) return notFound();
    const { supervisor } = (await request.json()) as { supervisor: number };
    const person = SUPERVISORS.find((entry) => entry.id === supervisor);
    if (!person) return HttpResponse.json({ supervisor: ['invalid'] }, { status: 400 });
    if (item.contract.state !== 'supervisor')
      return HttpResponse.json({ detail: 'Not ready.' }, { status: 409 });
    item.contract.state = 'active';
    item.contract.supervisors = [person.name];
    person.active += 1;
    return new HttpResponse(null, { status: 204 });
  }),
];
