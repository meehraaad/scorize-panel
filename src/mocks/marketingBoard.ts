import { http, HttpResponse } from 'msw';
import type {
  BoardCard,
  BoardData,
  CardDetail,
  CardEventRow,
  CardType,
  MarketingTeam,
  Person,
  Stage,
  StageNeed,
} from '@/features/marketing/boardApi';
import { forbidden, notFound, storage } from './session';

/**
 * Fake marketing board (lang `api/marketing/v1/board.py`, `team.py`; rules in `marketing/board.py`):
 * the six default stages (review is the manager's), three card types and four cards. Elham (7) is a
 * marketer; Amir (6, a superuser) is also the marketing manager. Same shapes and refusals as Django.
 */

const API = '/api/marketing/v1';
const MARKETERS = new Set([6, 7]);
const MANAGERS = new Set([6]);
const allowed = () => MARKETERS.has(storage.get() ?? 0);
const manager = () => MANAGERS.has(storage.get() ?? 0);
const DAY = 86_400_000;
const inDays = (days: number) => new Date(Date.now() + days * DAY).toISOString();
const dayOf = (iso: string) => iso.slice(0, 10);

const ELHAM: Person = { id: 11, name: 'الهام نوری', face: null };
const MINA: Person = { id: 12, name: 'مینا صادقی', face: { emoji: '🎨', color: 'rose' } };
const AMIR: Person = { id: 10, name: 'امیر عابدی', face: null };
const PEOPLE = [AMIR, ELHAM, MINA];

interface StoredCard extends Omit<CardDetail, 'next_stage' | 'missing' | 'checklist'> {
  archived: boolean;
}

interface State {
  stages: Stage[];
  types: CardType[];
  cards: StoredCard[];
  nextId: number;
}

let state: State | null = null;

const stage = (
  id: number,
  name: string,
  color: Stage['color'],
  order: number,
  extra: Partial<Stage> = {},
): Stage => ({
  id,
  name,
  color,
  order,
  card_limit: null,
  manager_only: false,
  assignee: null,
  task_text: '',
  task_days: 1,
  needs: [],
  ...extra,
});

function fresh(): State {
  const stages = [
    stage(1, 'ایده‌ها', 'gray', 0),
    stage(2, 'برنامه‌ریزی', 'blue', 1, {
      task_text: 'چک‌لیست و سناریو را آماده کن',
      needs: ['owner_date'],
    }),
    stage(3, 'در حال تولید', 'amber', 2, {
      task_text: 'تولید طبق چک‌لیست',
      task_days: 2,
      needs: ['owner_date'],
      card_limit: 6,
    }),
    stage(4, 'بازبینی مدیر', 'plum', 3, {
      manager_only: true,
      task_text: 'بازبینی و تأیید یا برگرداندن',
      needs: ['owner_date', 'checklist'],
    }),
    stage(5, 'آماده‌ی انتشار', 'green', 4, {
      task_text: 'انتشار در زمان تعیین‌شده',
      task_days: 0,
      needs: ['owner_date', 'checklist'],
    }),
    stage(6, 'منتشر شد', 'ink', 5, { needs: ['link'] }),
  ];
  const types: CardType[] = [
    {
      id: 1,
      name: 'ریلز',
      color: 'plum',
      checklist: ['سناریو', 'ضبط', 'تدوین'],
      days: 5,
      is_active: true,
    },
    { id: 2, name: 'پست', color: 'blue', checklist: ['متن', 'طراحی'], days: 3, is_active: true },
    {
      id: 3,
      name: 'بلاگ',
      color: 'green',
      checklist: ['پیش‌نویس', 'ویرایش'],
      days: 7,
      is_active: true,
    },
  ];
  const card = (
    id: number,
    title: string,
    stageId: number,
    extra: Partial<StoredCard> = {},
  ): StoredCard => ({
    id,
    title,
    stage: stageId,
    type: 1,
    owner: ELHAM,
    campaign: null,
    publish_at: inDays(3),
    returned: false,
    step: { id: 700 + id, due: dayOf(inDays(1)), done: false, owner: { id: 11, name: ELHAM.name } },
    has_file: false,
    link: '',
    description: '',
    caption: '',
    file: null,
    items: [
      { label: 'سناریو', done: true },
      { label: 'ضبط', done: false },
      { label: 'تدوین', done: false },
    ],
    created_at: inDays(-2),
    events: [
      {
        id: id * 10,
        kind: 'created',
        note: '',
        at: inDays(-2),
        from: null,
        to: null,
        by: ELHAM.name,
      },
    ],
    archived: false,
    ...extra,
  });
  return {
    stages,
    types,
    cards: [
      card(1, 'سری «یک روز در دانشگاه»', 1, { owner: null, publish_at: null, step: null }),
      card(2, 'ریلز «پذیرش بدون آیلتس در آلمان»', 3),
      card(3, 'کاروسل «۵ اشتباه رایج در SOP»', 4, {
        type: 2,
        owner: MINA,
        items: [
          { label: 'متن', done: true },
          { label: 'طراحی', done: true },
        ],
        step: { id: 703, due: dayOf(inDays(0)), done: false, owner: { id: 10, name: AMIR.name } },
      }),
      card(4, 'بلاگ «بورسیه‌های هلند»', 2, { type: 3, items: [] }),
    ],
    nextId: 100,
  };
}

const store = () => (state ??= fresh());

export function resetMarketingBoardMocks() {
  state = null;
}

const met = (card: StoredCard, need: StageNeed) =>
  ({
    owner_date: Boolean(card.owner && card.publish_at),
    file: card.has_file,
    caption: card.caption.trim() !== '',
    checklist: card.items.every((item) => item.done),
    link: card.link !== '',
  })[need];

const nextOf = (card: StoredCard) => {
  const { stages } = store();
  const index = stages.findIndex((item) => item.id === card.stage);
  return stages[index + 1] ?? null;
};

const rowOf = (card: StoredCard): BoardCard => ({
  id: card.id,
  title: card.title,
  stage: card.stage,
  type: card.type,
  owner: card.owner,
  campaign: card.campaign,
  publish_at: card.publish_at,
  checklist: { done: card.items.filter((item) => item.done).length, total: card.items.length },
  returned: card.returned,
  step: card.step,
  has_file: card.has_file,
  link: card.link,
});

const detailOf = (card: StoredCard): CardDetail => {
  const next = nextOf(card);
  return {
    ...rowOf(card),
    description: card.description,
    caption: card.caption,
    file: card.file,
    items: card.items,
    next_stage: next?.id ?? null,
    missing: next ? next.needs.filter((need) => !met(card, need)) : [],
    created_at: card.created_at,
    events: card.events,
  };
};

const board = (): BoardData => {
  const { stages, types, cards } = store();
  return {
    board: { id: 1, name: 'محتوا' },
    can_manage: manager(),
    stages,
    types,
    cards: cards.filter((card) => !card.archived).map(rowOf),
    people: PEOPLE,
    campaigns: [{ id: 31, title: 'وبینار اپلای کانادا ۲۰۲۷' }],
  };
};

const find = (id: string | readonly string[] | undefined) =>
  store().cards.find((card) => String(card.id) === String(id) && !card.archived);

const stageName = (id: number) => store().stages.find((item) => item.id === id)?.name ?? null;

function enter(card: StoredCard, to: number, kind: CardEventRow['kind'], note = '') {
  const from = card.stage;
  const target = store().stages.find((item) => item.id === to);
  card.stage = to;
  card.events.unshift({
    id: store().nextId++,
    kind,
    note,
    at: new Date().toISOString(),
    from: stageName(from),
    to: stageName(to),
    by: manager() ? AMIR.name : ELHAM.name,
  });
  card.step =
    target?.task_text && card.owner
      ? {
          id: store().nextId++,
          due: dayOf(inDays(target.task_days)),
          done: false,
          owner: target.manager_only
            ? { id: AMIR.id, name: AMIR.name }
            : { id: card.owner.id, name: card.owner.name },
        }
      : null;
}

const conflict = (code: string, detail: string, missing: StageNeed[] = []) =>
  HttpResponse.json({ detail, code, missing }, { status: 409 });

const stagesBody = () => ({ stages: store().stages });
const typesBody = () => ({ types: store().types });

function team(): MarketingTeam {
  const { cards } = store();
  return {
    members: [
      {
        ...ELHAM,
        attendance: {
          day: dayOf(inDays(0)),
          status: 'present',
          check_in: new Date().toISOString(),
          check_out: null,
          worked_seconds: 0,
          late_seconds: 0,
        },
        tasks: { today: 2, overdue: 1, week: 4 },
        cards: cards.filter((card) => !card.archived && card.owner?.id === ELHAM.id).length,
        late_days: 1,
      },
      {
        ...MINA,
        attendance: null,
        tasks: { today: 1, overdue: 0, week: 2 },
        cards: cards.filter((card) => !card.archived && card.owner?.id === MINA.id).length,
        late_days: 0,
      },
    ],
    review: cards
      .filter(
        (card) => !card.archived && store().stages.find((s) => s.id === card.stage)?.manager_only,
      )
      .map(rowOf),
  };
}

export const marketingBoardHandlers = [
  http.get(`${API}/board/`, () => (allowed() ? HttpResponse.json(board()) : forbidden())),
  http.get(`${API}/team/`, () => (manager() ? HttpResponse.json(team()) : forbidden())),
  http.post(`${API}/cards/`, async ({ request }) => {
    if (!allowed()) return forbidden();
    const body = (await request.json()) as Partial<CardDetail> & {
      owner?: number | null;
      campaign?: number | null;
    };
    if (!body.title?.trim())
      return HttpResponse.json({ title: ['This field is required.'] }, { status: 400 });
    const type = store().types.find((item) => item.id === body.type);
    const card: StoredCard = {
      id: store().nextId++,
      title: body.title,
      stage: body.stage ?? store().stages[0]?.id ?? 1,
      type: type?.id ?? null,
      owner: PEOPLE.find((person) => person.id === body.owner) ?? null,
      campaign: null,
      publish_at: body.publish_at ?? null,
      returned: false,
      step: null,
      has_file: false,
      link: '',
      description: '',
      caption: '',
      file: null,
      items: (type?.checklist ?? []).map((label) => ({ label, done: false })),
      created_at: new Date().toISOString(),
      events: [],
      archived: false,
    };
    store().cards.push(card);
    enter(card, card.stage, 'created');
    return HttpResponse.json(detailOf(card), { status: 201 });
  }),
  http.get(`${API}/cards/:id/`, ({ params }) => {
    if (!allowed()) return forbidden();
    const card = find(params.id);
    return card ? HttpResponse.json(detailOf(card)) : notFound();
  }),
  http.patch(`${API}/cards/:id/`, async ({ params, request }) => {
    if (!allowed()) return forbidden();
    const card = find(params.id);
    if (!card) return notFound();
    const body = (await request.json()) as Record<string, unknown>;
    if ('title' in body) card.title = String(body.title);
    if ('description' in body) card.description = String(body.description);
    if ('caption' in body) card.caption = String(body.caption);
    if ('link' in body) card.link = String(body.link);
    if ('publish_at' in body) card.publish_at = (body.publish_at as string | null) ?? null;
    if ('type' in body) card.type = (body.type as number | null) ?? null;
    if ('owner' in body) card.owner = PEOPLE.find((person) => person.id === body.owner) ?? null;
    if ('checklist' in body) card.items = body.checklist as StoredCard['items'];
    return HttpResponse.json(detailOf(card));
  }),
  http.post(`${API}/cards/:id/move/`, async ({ params, request }) => {
    if (!allowed()) return forbidden();
    const card = find(params.id);
    if (!card) return notFound();
    const { stage: to } = (await request.json()) as { stage: number };
    const { stages } = store();
    const from = stages.find((item) => item.id === card.stage);
    const target = stages.find((item) => item.id === to);
    if (!from || !target) return conflict('board', 'That stage is not on this board.');
    if (to === card.stage) return conflict('same', 'The card is already in this stage.');
    if (from.manager_only && !manager())
      return conflict('manager_only', 'Only the marketing manager takes a card out of this stage.');
    const missing =
      target.order > from.order ? target.needs.filter((need) => !met(card, need)) : [];
    if (missing.length)
      return conflict('needs', 'The card needs more before it can go there.', missing);
    if (target.order > from.order) card.returned = false;
    enter(card, to, 'moved');
    return HttpResponse.json(detailOf(card));
  }),
  http.post(`${API}/cards/:id/return/`, async ({ params, request }) => {
    if (!manager()) return forbidden();
    const card = find(params.id);
    if (!card) return notFound();
    const { stage: to, note } = (await request.json()) as { stage: number; note: string };
    card.returned = true;
    enter(card, to, 'returned', note);
    return HttpResponse.json(detailOf(card));
  }),
  http.post(`${API}/cards/:id/archive/`, ({ params }) => {
    if (!allowed()) return forbidden();
    const card = find(params.id);
    if (!card) return notFound();
    card.archived = true;
    return new HttpResponse(null, { status: 204 });
  }),
  http.post(`${API}/cards/:id/file/`, ({ params }) => {
    if (!allowed()) return forbidden();
    const card = find(params.id);
    if (!card) return notFound();
    card.has_file = true;
    card.file = `/media/marketing-cards/${String(card.id)}.pdf`;
    return HttpResponse.json(detailOf(card));
  }),
  http.delete(`${API}/cards/:id/file/`, ({ params }) => {
    if (!allowed()) return forbidden();
    const card = find(params.id);
    if (!card) return notFound();
    card.has_file = false;
    card.file = null;
    return HttpResponse.json(detailOf(card));
  }),
  http.post(`${API}/stages/order/`, async ({ request }) => {
    if (!manager()) return forbidden();
    const { ids } = (await request.json()) as { ids: number[] };
    const { stages } = store();
    store().stages = ids.flatMap((id, order) => {
      const found = stages.find((item) => item.id === id);
      return found ? [{ ...found, order }] : [];
    });
    return HttpResponse.json(stagesBody());
  }),
  http.post(`${API}/stages/`, async ({ request }) => {
    if (!manager()) return forbidden();
    const body = (await request.json()) as Partial<Stage> & { name: string };
    const { stages } = store();
    stages.push(stage(store().nextId++, body.name, body.color ?? 'gray', stages.length, body));
    return HttpResponse.json(stagesBody(), { status: 201 });
  }),
  http.patch(`${API}/stages/:id/`, async ({ params, request }) => {
    if (!manager()) return forbidden();
    const found = store().stages.find((item) => String(item.id) === params.id);
    if (!found) return notFound();
    const body = (await request.json()) as Partial<Stage> & { assignee?: number | null };
    const { assignee, ...rest } = body;
    Object.assign(found, rest);
    if (assignee !== undefined) {
      const person = PEOPLE.find((item) => item.id === assignee);
      found.assignee = person ? { id: person.id, name: person.name } : null;
    }
    return HttpResponse.json(stagesBody());
  }),
  http.delete(`${API}/stages/:id/`, ({ params, request }) => {
    if (!manager()) return forbidden();
    const { stages, cards } = store();
    const found = stages.find((item) => String(item.id) === params.id);
    if (!found) return notFound();
    if (stages.length <= 1) return conflict('last', 'A board keeps at least one stage.');
    const inIt = cards.filter((card) => card.stage === found.id && !card.archived);
    const moveTo = Number(new URL(request.url).searchParams.get('move_to'));
    if (inIt.length && !stages.some((item) => item.id === moveTo && item.id !== found.id))
      return conflict('move_to', 'Choose the stage its cards go to.');
    for (const card of inIt) card.stage = moveTo;
    store().stages = stages.filter((item) => item !== found);
    return HttpResponse.json(stagesBody());
  }),
  http.post(`${API}/types/`, async ({ request }) => {
    if (!manager()) return forbidden();
    const body = (await request.json()) as Partial<CardType> & { name: string };
    store().types.push({
      id: store().nextId++,
      name: body.name,
      color: body.color ?? 'plum',
      checklist: body.checklist ?? [],
      days: body.days ?? 3,
      is_active: true,
    });
    return HttpResponse.json(typesBody(), { status: 201 });
  }),
  http.patch(`${API}/types/:id/`, async ({ params, request }) => {
    if (!manager()) return forbidden();
    const found = store().types.find((item) => String(item.id) === params.id);
    if (!found) return notFound();
    Object.assign(found, (await request.json()) as Partial<CardType>);
    return HttpResponse.json(typesBody());
  }),
];
