import { http, HttpResponse } from 'msw';
import type { CustomerTag, ManagerTag, TagInput } from '@/features/sales/api';
import { MAX_TAGS_PER_CUSTOMER, tagKey } from '@/features/sales/api';
import { forbidden, notFound, storage } from './session';

/**
 * Customer tags (S49) as api/sales/v1/tags.py answers them: the team's list, each customer's tags,
 * putting one on by name (which may add it to the list), and the manager's changes. The leads list and customer card add each customer's tags from here
 * (src/mocks/salesStaff.ts), as Django adds them from `TaggedCustomer`.
 */

const BASE = '/api/sales/v1';
const SELLERS = new Set([3, 4]);
const MANAGERS = new Set([4]);
/** Django's `MAX_ACTIVE` (api/sales/v1/tags.py). */
const MAX_ACTIVE = 40;

interface State {
  tags: (CustomerTag & { order: number })[];
  /** Customer id → tag ids. */
  on: Map<number, number[]>;
  next: number;
}

const fresh = (): State => ({
  tags: [
    { id: 1, name: 'وی‌آی‌پی', tone: 'amber', active: true, order: 1 },
    { id: 2, name: 'نیاز به آیلتس', tone: 'blue', active: true, order: 2 },
    { id: 3, name: 'مشکل بودجه', tone: 'red', active: true, order: 3 },
    { id: 4, name: 'کمپین تابستان', tone: 'gray', active: false, order: 4 },
  ],
  // Erfan (src/mocks/sales.ts) carries one.
  on: new Map([[105, [1]]]),
  next: 5,
});

let state = fresh();

export function resetTagMocks() {
  state = fresh();
}

const ordered = (ids: readonly number[]) =>
  state.tags.filter((tag) => ids.includes(tag.id)).map((tag) => tag.id);

/** A customer's tag ids, in the list's order. */
export const tagsOfCustomer = (customer: number) => ordered(state.on.get(customer) ?? []);

const row = ({ order: _order, ...tag }: State['tags'][number]): CustomerTag => tag;

const managerRow = (tag: State['tags'][number]): ManagerTag => ({
  ...tag,
  customers: [...state.on.values()].filter((ids) => ids.includes(tag.id)).length,
});

const seller = () => SELLERS.has(storage.get() ?? 0);
const manager = () => MANAGERS.has(storage.get() ?? 0);

/** `leads/bulk/` add_tag / remove_tag for these customers (the most-tagged are skipped). */
export function bulkTag(customers: readonly number[], change: { add?: number; remove?: number }) {
  for (const customer of customers) {
    const ids = state.on.get(customer) ?? [];
    if (change.add !== undefined && !ids.includes(change.add) && ids.length < MAX_TAGS_PER_CUSTOMER)
      state.on.set(customer, [...ids, change.add]);
    if (change.remove !== undefined)
      state.on.set(
        customer,
        ids.filter((id) => id !== change.remove),
      );
  }
}

function nameError(name: string | undefined, except?: number) {
  const key = tagKey(name ?? '');
  if (!key) return { name: ['Write a name.'] };
  const same = state.tags.find((tag) => tag.id !== except && tagKey(tag.name) === key);
  return same ? { name: [`«${same.name}» is already on the list.`] } : null;
}

export const tagHandlers = [
  http.get(`${BASE}/tags/`, () =>
    seller() ? HttpResponse.json(state.tags.map(row)) : forbidden(),
  ),

  http.put(`${BASE}/customers/:id/tags/`, async ({ params, request }) => {
    if (!seller()) return forbidden();
    const customer = Number(params.id);
    const { tags } = (await request.json()) as { tags: number[] };
    const wanted = [...new Set(tags)];
    if (wanted.length > MAX_TAGS_PER_CUSTOMER)
      return HttpResponse.json(
        { tags: ['Ensure this field has no more than 5 elements.'] },
        {
          status: 400,
        },
      );
    const current = state.on.get(customer) ?? [];
    const added = wanted.filter((id) => !current.includes(id));
    if (added.some((id) => !state.tags.find((tag) => tag.id === id)?.active))
      return HttpResponse.json({ tags: ['Choose tags from the team list.'] }, { status: 400 });
    state.on.set(customer, wanted);
    return HttpResponse.json({ tags: tagsOfCustomer(customer) });
  }),

  // Puts a tag on by name: the one with the same key, else a new one (201).
  http.post(`${BASE}/customers/:id/tags/`, async ({ params, request }) => {
    if (!seller()) return forbidden();
    const customer = Number(params.id);
    const { name } = (await request.json()) as { name?: string };
    const key = tagKey(name ?? '');
    if (!key) return HttpResponse.json({ name: ['Write a name.'] }, { status: 400 });
    const current = state.on.get(customer) ?? [];
    let tag = state.tags.find((item) => tagKey(item.name) === key);
    if (tag && current.includes(tag.id))
      return HttpResponse.json({ tag: row(tag), tags: tagsOfCustomer(customer) });
    if (tag && !tag.active)
      return HttpResponse.json(
        { detail: `«${tag.name}» is archived.`, code: 'archived' },
        { status: 409 },
      );
    if (current.length >= MAX_TAGS_PER_CUSTOMER)
      return HttpResponse.json({ name: ['A customer has at most 5 tags.'] }, { status: 400 });
    const created = !tag;
    if (!tag) {
      if (state.tags.filter((item) => item.active).length >= MAX_ACTIVE)
        return HttpResponse.json(
          { detail: 'The list is full.', code: 'too_many' },
          { status: 409 },
        );
      tag = {
        id: state.next++,
        name: (name ?? '').trim().split(/\s+/).join(' '),
        tone: 'blue',
        active: true,
        order: Math.max(0, ...state.tags.map((item) => item.order)) + 1,
      };
      state.tags.push(tag);
    }
    state.on.set(customer, [...current, tag.id]);
    return HttpResponse.json(
      { tag: row(tag), tags: tagsOfCustomer(customer) },
      { status: created ? 201 : 200 },
    );
  }),

  http.get(`${BASE}/manager/tags/`, () =>
    manager() ? HttpResponse.json(state.tags.map(managerRow)) : forbidden(),
  ),

  http.post(`${BASE}/manager/tags/`, async ({ request }) => {
    if (!manager()) return forbidden();
    const body = (await request.json()) as TagInput;
    const error = nameError(body.name);
    if (error) return HttpResponse.json(error, { status: 400 });
    if (state.tags.filter((tag) => tag.active).length >= MAX_ACTIVE)
      return HttpResponse.json({ detail: 'Archive one first.' }, { status: 409 });
    const tag = {
      id: state.next++,
      name: (body.name ?? '').trim().split(/\s+/).join(' '),
      tone: body.tone ?? 'blue',
      active: true,
      order: body.order ?? Math.max(0, ...state.tags.map((item) => item.order)) + 1,
    };
    state.tags.push(tag);
    return HttpResponse.json(managerRow(tag), { status: 201 });
  }),

  http.patch(`${BASE}/manager/tags/:id/`, async ({ params, request }) => {
    if (!manager()) return forbidden();
    const tag = state.tags.find((item) => item.id === Number(params.id));
    if (!tag) return notFound();
    const body = (await request.json()) as TagInput;
    if (body.name !== undefined) {
      const error = nameError(body.name, tag.id);
      if (error) return HttpResponse.json(error, { status: 400 });
      tag.name = body.name.trim().split(/\s+/).join(' ');
    }
    if (body.tone) tag.tone = body.tone;
    if (body.order !== undefined) tag.order = body.order;
    if (body.active !== undefined) tag.active = body.active;
    state.tags.sort((a, b) => a.order - b.order || a.id - b.id);
    return HttpResponse.json(managerRow(tag));
  }),

  http.delete(`${BASE}/manager/tags/:id/`, ({ params }) => {
    if (!manager()) return forbidden();
    const id = Number(params.id);
    if (!state.tags.some((tag) => tag.id === id)) return notFound();
    if ([...state.on.values()].some((ids) => ids.includes(id)))
      return HttpResponse.json(
        { detail: 'Customers carry this tag. Archive it instead.' },
        { status: 409 },
      );
    state.tags = state.tags.filter((tag) => tag.id !== id);
    return new HttpResponse(null, { status: 204 });
  }),
];
