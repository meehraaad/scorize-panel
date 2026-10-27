import { http, HttpResponse } from 'msw';
import type { Reaction, ReactionDetail } from '@/lib/tasks/api';
import { TASK_REACTIONS, type TaskEmoji } from '@/lib/tasks/reactions';

/**
 * Fake `POST tasks/<id>/reactions/` (docs/backend-changes.md T14) for every panel: Django's
 * `ToDoReaction`, one per person and emoji. Others' reactions are sample names; mine is a flag.
 * The tasks mocks lay these over their rows (`withReactions`), as Django annotates them.
 */

const TASKS = '/api/staff/v1/tasks';
/** Django's `REACTION_NAMES`: the popup names a few of the others. */
const NAMES_SHOWN = 3;

interface Entry {
  emoji: TaskEmoji;
  others: string[];
  mine: boolean;
}

let store = new Map<number, Entry[]>();

const SEED: [number, TaskEmoji, string[]][] = [
  [211, '👀', ['نیما رستمی']],
  [411, '👍', ['الهام رضوی', 'نگار حسینی']],
];

function seed() {
  store = new Map();
  for (const [id, emoji, others] of SEED) store.set(id, [{ emoji, others, mine: false }]);
}
seed();

const entriesOf = (id: number) =>
  (store.get(id) ?? [])
    .filter((entry) => entry.mine || entry.others.length > 0)
    .map((entry) => ({ ...entry, count: entry.others.length + Number(entry.mine) }))
    .sort((a, b) => b.count - a.count);

/** The list rows' summary. */
export const reactionsOf = (id: number): Reaction[] =>
  entriesOf(id).map(({ emoji, count, mine }) => ({ emoji, count, mine }));

/** The popup's, with who else reacted. */
export const reactionDetails = (id: number): ReactionDetail[] =>
  entriesOf(id).map(({ emoji, count, mine, others }) => ({
    emoji,
    count,
    mine,
    names: others.slice(0, NAMES_SHOWN),
  }));

/** Rows with the reactions they have now. */
export const withReactions = <T extends { id: number }>(rows: readonly T[]) =>
  rows.map((row) => ({ ...row, reactions: reactionsOf(row.id) }));

const EMOJIS: readonly string[] = TASK_REACTIONS.map((item) => item.emoji);

export const taskReactionHandlers = [
  http.post(`${TASKS}/:id/reactions/`, async ({ params, request }) => {
    const { emoji } = (await request.json().catch(() => ({}))) as { emoji?: string };
    if (!emoji || !EMOJIS.includes(emoji))
      return HttpResponse.json({ emoji: ['invalid'] }, { status: 400 });
    const id = Number(params.id);
    const entries = store.get(id) ?? [];
    const entry = entries.find((item) => item.emoji === emoji);
    if (entry) entry.mine = !entry.mine;
    else entries.push({ emoji: emoji as TaskEmoji, others: [], mine: true });
    store.set(id, entries);
    return HttpResponse.json(reactionDetails(id));
  }),
];

export function resetTaskReactionMocks() {
  seed();
}
