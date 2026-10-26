import { http, HttpResponse } from 'msw';
import type { WritingOffer, WritingOffers } from '@/features/documents/offers';
import type { WritingForm } from '@/features/writing/api';
import { cvForm } from '@/features/writing/cvForm';
import { missingInForm, type Answers, type FormSpec } from '@/features/writing/formSpec';
import { recommendationForm } from '@/features/writing/recommendationForm';
import { sopForm } from '@/features/writing/sopForm';
import { notFound, storage } from './session';

/**
 * Django's writing offered without a contract (scorize-revolution `api/applicant/v1/offers.py`,
 * H66), for the tests: the offers next to the new user's documents, opening a form before paying,
 * and that form's final submit asking for the payment (402) until it is paid. A contract with
 * writing has every service in it (`included`). The forms of a person's own orders are answered
 * here; anyone else's fall through to the case's handlers (src/mocks/applicant.ts).
 */

const BASE = '/api/applicant/v1';
const SARA = 1;
const KINDS = ['sop', 'cv', 'recommendation'] as const;
type Kind = (typeof KINDS)[number];
const SPECS: Record<Kind, FormSpec> = {
  sop: sopForm,
  cv: cvForm,
  recommendation: recommendationForm,
};
const PRICES: Record<Kind, number> = { sop: 4_500_000, cv: 2_500_000, recommendation: 1_800_000 };

interface OwnOrder {
  paid: boolean;
  payment_id: number;
  form: WritingForm;
}

const ordersOf = new Map<number, Map<Kind, OwnOrder>>();
let nextPayment = 600;

const isKind = (value: unknown): value is Kind => KINDS.includes(value as Kind);
const included = (user: number) => user === SARA;

function ownOrder(kind: unknown): OwnOrder | undefined {
  const user = storage.get();
  return user && isKind(kind) ? ordersOf.get(user)?.get(kind) : undefined;
}

/** Marks a person's order paid (the payment page's receipt, accepted), for the tests. */
export function payWritingOrder(user: number, kind: Kind) {
  const order = ordersOf.get(user)?.get(kind);
  if (order) order.paid = true;
}

function offersOf(user: number): WritingOffers {
  if (included(user)) return { included: true, offers: [], samples: SAMPLES };
  const own = ordersOf.get(user);
  const offers = KINDS.map((kind): WritingOffer => {
    const order = own?.get(kind);
    return {
      kind,
      price: PRICES[kind],
      old_price: kind === 'sop' ? 5_000_000 : null,
      discount_ends_at: kind === 'sop' ? new Date(Date.now() + 7 * 86_400_000).toISOString() : null,
      order: order ? { paid: order.paid, step: order.form.is_final ? 'writing' : 'form' } : null,
      testimonial:
        kind === 'sop'
          ? {
              name: 'نگار رحیمی',
              audio: 'https://scorize.local/media/voice.mp3',
              video: null,
              poster: null,
            }
          : null,
    };
  });
  return { included: false, offers, samples: SAMPLES };
}

const SAMPLES: WritingOffers['samples'] = [
  {
    id: 1,
    university: 'University of Toronto',
    field: 'مهندسی کامپیوتر',
    degree: 'master',
    ielts: 7,
    toefl: null,
    gpa: 17.2,
    date: '2026-09-01',
  },
];

export const writingOfferHandlers = [
  http.get(`${BASE}/writing-offers/`, () => {
    const user = storage.get();
    return user ? HttpResponse.json(offersOf(user)) : notFound();
  }),

  http.post(`${BASE}/writing/:kind/start/`, ({ params }) => {
    const user = storage.get();
    if (!user || !isKind(params.kind)) return notFound();
    if (included(user))
      return HttpResponse.json({ detail: 'Included.', code: 'included' }, { status: 409 });
    const own = ordersOf.get(user) ?? new Map<Kind, OwnOrder>();
    if (own.has(params.kind)) return HttpResponse.json({ kind: params.kind });
    own.set(params.kind, {
      paid: false,
      payment_id: nextPayment++,
      form: {
        is_final: false,
        final_at: null,
        updated_at: null,
        answers: {},
        contact_phone: null,
        orders: [],
      },
    });
    ordersOf.set(user, own);
    return HttpResponse.json({ kind: params.kind }, { status: 201 });
  }),

  // A person's own order: its form, with what it costs until it is paid.
  http.get(`${BASE}/writing/:type/`, ({ params }) => {
    const order = ownOrder(params.type);
    if (!order) return undefined;
    const user = storage.get() ?? 0;
    const kinds = [...(ordersOf.get(user)?.keys() ?? [])];
    return HttpResponse.json({
      ...order.form,
      orders: kinds,
      purchase: order.paid ? null : { price: PRICES[params.type as Kind] },
    });
  }),

  http.patch(`${BASE}/writing/:type/`, async ({ params, request }) => {
    const order = ownOrder(params.type);
    if (!order) return undefined;
    if (order.form.is_final) return HttpResponse.json({ detail: 'Final.' }, { status: 409 });
    const body = (await request.json()) as { answers?: Answers; contact_phone?: string };
    order.form.answers = { ...order.form.answers, ...body.answers };
    if (body.contact_phone !== undefined) order.form.contact_phone = body.contact_phone;
    order.form.updated_at = new Date().toISOString();
    return HttpResponse.json({ updated_at: order.form.updated_at });
  }),

  http.post(`${BASE}/writing/:type/final/`, async ({ params, request }) => {
    const order = ownOrder(params.type);
    if (!order) return undefined;
    if (order.form.is_final) return HttpResponse.json({ detail: 'Final.' }, { status: 409 });
    const { answers = {} } = (await request.json()) as { answers?: Answers };
    const merged = { ...order.form.answers, ...answers };
    const missing = missingInForm(SPECS[params.type as Kind], merged).map((item) => item.key);
    if (missing.length) return HttpResponse.json({ missing }, { status: 400 });
    order.form.answers = merged;
    // Django keeps the answers and asks for the payment; the writer starts once it is paid.
    if (!order.paid) return HttpResponse.json({ payment_id: order.payment_id }, { status: 402 });
    const now = new Date().toISOString();
    order.form = { ...order.form, is_final: true, final_at: now, updated_at: now };
    return new HttpResponse(null, { status: 204 });
  }),
];

export function resetWritingOfferMocks() {
  ordersOf.clear();
  nextPayment = 600;
}
