import { http, HttpResponse } from 'msw';
import type { BoardTask, MyBoard } from '@/lib/boards/api';
import { MAX_COLUMNS } from '@/lib/boards/api';
import { notFound, storage } from './session';

/**
 * Fake «برد من» (lang `api/boards/v1/`): one board per mock user and panel, made empty when first
 * asked for; the same rules as Django (the column cap, a task once per board, a card before
 * another or at a column's end). The tasks that can go on it are a few fixed open ones.
 */

const API = '/api/boards/v1';
const DAY = 86_400_000;

const TASKS: BoardTask[] = [
  ['تماس اول با بهاره نوری', 'mine', 0, true],
  ['فرستادن فرم پذیرش امیر رحیمی', 'mine', -1, true],
  ['مرتب کردن لیدهای آیلتس', 'mine', 2, false],
  ['تأییدیهٔ تخفیف ویژه', 'request', 1, true],
].map(([text, kind, days, timed], index) => ({
  id: 9500 + index,
  text: text as string,
  due_at: new Date(Date.now() + (days as number) * DAY).toISOString(),
  timed: timed as boolean,
  kind: kind as BoardTask['kind'],
  status: kind === 'mine' ? 'open' : 'sent',
  done: false,
  penalty: false,
}));

let boards: (MyBoard & { owner: number })[] = [];
let nextId = 1;

const boardOf = (panel: string) => {
  const owner = storage.get() ?? 0;
  let board = boards.find((item) => item.owner === owner && item.panel === panel);
  if (!board) {
    board = { id: nextId++, owner, panel: panel as MyBoard['panel'], columns: [] };
    boards.push(board);
  }
  return board;
};

const mine = () => boards.filter((board) => board.owner === (storage.get() ?? 0));
const answer = ({ owner: _owner, ...board }: MyBoard & { owner: number }) => board;
const columnOf = (id: number) =>
  mine()
    .flatMap((board) => board.columns.map((column) => ({ board, column })))
    .find((item) => item.column.id === id);
const cardOf = (id: number) =>
  mine()
    .flatMap((board) =>
      board.columns.flatMap((column) =>
        column.cards.map((card, index) => ({ board, column, card, index })),
      ),
    )
    .find((item) => item.card.id === id);

export function resetBoardMocks() {
  boards = [];
  nextId = 1;
}

export const boardHandlers = [
  http.get(`${API}/board/`, ({ request }) =>
    HttpResponse.json(answer(boardOf(new URL(request.url).searchParams.get('panel') ?? ''))),
  ),

  http.get(`${API}/candidates/`, ({ request }) => {
    const params = new URL(request.url).searchParams;
    const board = boardOf(params.get('panel') ?? '');
    const placed = new Set(
      board.columns.flatMap((column) => column.cards.map((card) => card.task.id)),
    );
    const search = (params.get('search') ?? '').trim();
    return HttpResponse.json(
      TASKS.filter(
        (task) => !placed.has(task.id) && (search.length < 2 || task.text.includes(search)),
      ),
    );
  }),

  http.post(`${API}/columns/`, async ({ request }) => {
    const body = (await request.json()) as { panel: string; names: string[] };
    const board = boardOf(body.panel);
    if (board.columns.length + body.names.length > MAX_COLUMNS)
      return HttpResponse.json({ names: ['A board has at most 20 columns.'] }, { status: 400 });
    for (const name of body.names)
      board.columns.push({ id: nextId++, name: name.trim(), cards: [] });
    return HttpResponse.json(answer(board), { status: 201 });
  }),

  http.post(`${API}/columns/order/`, async ({ request }) => {
    const body = (await request.json()) as { panel: string; ids: number[] };
    const board = boardOf(body.panel);
    const byId = new Map(board.columns.map((column) => [column.id, column]));
    if (body.ids.length !== byId.size || body.ids.some((id) => !byId.has(id)))
      return HttpResponse.json({ detail: 'The board changed; reload it.' }, { status: 409 });
    board.columns = body.ids.map((id) => byId.get(id) as MyBoard['columns'][number]);
    return HttpResponse.json(answer(board));
  }),

  http.patch(`${API}/columns/:id/`, async ({ params, request }) => {
    const found = columnOf(Number(params['id']));
    if (!found) return notFound();
    found.column.name = ((await request.json()) as { name: string }).name.trim();
    return HttpResponse.json(answer(found.board));
  }),

  http.delete(`${API}/columns/:id/`, ({ params }) => {
    const found = columnOf(Number(params['id']));
    if (!found) return notFound();
    found.board.columns = found.board.columns.filter((column) => column !== found.column);
    return new HttpResponse(null, { status: 204 });
  }),

  http.post(`${API}/cards/`, async ({ request }) => {
    const body = (await request.json()) as { column: number; task: number };
    const found = columnOf(body.column);
    const task = TASKS.find((item) => item.id === body.task);
    if (!found || !task) return notFound();
    if (found.board.columns.some((column) => column.cards.some((card) => card.task.id === task.id)))
      return HttpResponse.json({ detail: 'This task is already on your board.' }, { status: 409 });
    const card = { id: nextId++, column: found.column.id, task };
    found.column.cards.push(card);
    return HttpResponse.json(card, { status: 201 });
  }),

  http.patch(`${API}/cards/:id/`, async ({ params, request }) => {
    const body = (await request.json()) as { column: number; before: number | null };
    const found = cardOf(Number(params['id']));
    const target = found?.board.columns.find((column) => column.id === body.column);
    if (!found || !target) return notFound();
    found.column.cards.splice(found.index, 1);
    const card = { ...found.card, column: target.id };
    const at =
      body.before === null ? -1 : target.cards.findIndex((item) => item.id === body.before);
    if (at < 0) target.cards.push(card);
    else target.cards.splice(at, 0, card);
    return HttpResponse.json(card);
  }),

  http.delete(`${API}/cards/:id/`, ({ params }) => {
    const found = cardOf(Number(params['id']));
    if (!found) return notFound();
    found.column.cards.splice(found.index, 1);
    return new HttpResponse(null, { status: 204 });
  }),
];
