import { useQuery } from '@tanstack/react-query';
import { useState, type ReactNode, type SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Button } from '@/components/ui/Button';
import { SelectField } from '@/components/ui/Choices';
import { Dialog } from '@/components/ui/Dialog';
import { SearchField } from '@/components/ui/Filters';
import { Icon } from '@/components/ui/Icon';
import { PageWorkspace } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import { TextField } from '@/components/ui/TextField';
import { NewTaskButton } from '@/components/tasks/NewTask';
import type { Slots } from '@/components/tasks/CalendarSlots';
import {
  MAX_COLUMNS,
  candidatesQuery,
  myBoardQuery,
  useCardChange,
  useColumnChange,
  type BoardCard,
  type BoardColumn,
  type BoardPanel,
  type BoardScope,
  type BoardTask,
} from '@/lib/boards/api';
import { useFormat } from '@/lib/i18n/useFormat';
import { toast } from '@/lib/toast';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { KanbanBoard } from './KanbanBoard';

/** Lane dots, in turn. */
const DOTS = ['bg-primary', 'bg-info', 'bg-warn', 'bg-good'] as const;
const SEARCH_MIN = 2;
/** The empty board's three points. */
const EMPTY_POINTS = ['fromNew', 'sent', 'remove'] as const;

/** The tasks page with one task open. */
const taskHref = (panel: BoardPanel, task: number) =>
  `/tasks?${new URLSearchParams({ panel, task: String(task) }).toString()}`;

/**
 * «برد من» (meeting0, canvas 6A/6B): my own board in a panel, which only I see. Columns I name and
 * order; on them my tasks, dragged by their grip (onto a card: before it) or moved from their
 * window. A card only arranges a task: moving or removing it never changes the task. With no
 * columns yet, a column to name or the three suggested ones. `top`: above the heading (the tasks
 * hub's tabs); `switcher`: beside the actions (the team board's «برد فروش | برد من»).
 * Needs the `tasks` namespace on the route.
 */
export function MyBoardView({
  panel,
  scope = 'mine',
  top,
  switcher,
  slots,
}: {
  panel: BoardPanel;
  /** `team`: the panel's team board (meeting0 round 2): its admin keeps it, each moves their own. */
  scope?: BoardScope;
  top?: ReactNode;
  switcher?: ReactNode;
  /** The composer's «از تقویم» (the panel's week). */
  slots?: Slots | undefined;
}) {
  const { t } = useTranslation('tasks');
  const { data, isPending, isError } = useQuery(myBoardQuery(panel, scope));
  const columns = data?.columns ?? [];
  const manage = data?.can_manage ?? false;
  const team = scope === 'team';

  return (
    <PageWorkspace fullscreen={false} onExitFullscreen={() => undefined}>
      <div className="flex flex-none flex-col gap-3 border-y border-hair bg-surface px-4 py-4 lg:px-6">
        {top}
        <PageHeader
          size="workspace"
          title={t(team ? 'board.teamTitle' : 'board.title')}
          subtitle={t(team ? 'board.teamHint' : 'board.private')}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              {switcher}
              {(!team || manage) && <NewTaskButton panel={panel} slots={slots} />}
            </div>
          }
        />
      </div>
      {isError ? (
        <p role="alert" className="m-0 p-6 text-sm text-text-2">
          {t('board.error')}
        </p>
      ) : isPending ? (
        <div aria-busy="true" className="flex-1 animate-pulse bg-board" />
      ) : columns.length === 0 ? (
        manage ? (
          <EmptyBoard panel={panel} scope={scope} />
        ) : (
          <p className="m-0 flex-1 bg-board p-6 text-sm text-text-2">{t('board.teamEmpty')}</p>
        )
      ) : (
        <Board panel={panel} scope={scope} manage={manage} columns={columns} />
      )}
    </PageWorkspace>
  );
}

function Board({
  panel,
  scope,
  manage,
  columns,
}: {
  panel: BoardPanel;
  scope: BoardScope;
  manage: boolean;
  columns: BoardColumn[];
}) {
  const { t } = useTranslation('tasks');
  const move = useCardChange(panel, scope);
  const [editing, setEditing] = useState<BoardColumn | null>(null);
  const [adding, setAdding] = useState<BoardColumn | null>(null);
  const [opened, setOpened] = useState<BoardCard | null>(null);
  const [naming, setNaming] = useState(false);
  const [now] = useState(() => Date.now());
  const cards = columns.flatMap((column) => column.cards);

  return (
    <>
      <KanbanBoard
        label={t(scope === 'team' ? 'board.teamTitle' : 'board.title')}
        sortable
        lanes={columns.map((column, index) => ({
          id: column.id,
          title: column.name,
          dot: DOTS[index % DOTS.length] ?? 'bg-primary',
        }))}
        cards={cards}
        laneOf={(card) => card.column}
        canDrag={(card) => card.can_move}
        onMove={(card, column, before) =>
          move.mutate(
            { kind: 'move', card: card.id, column, before: before?.id ?? null },
            { onError: () => toast.error(t('board.failed')) },
          )
        }
        renderCard={(card) => <CardFace card={card} now={now} onOpen={() => setOpened(card)} />}
        emptyText={t('board.emptyColumn')}
        limitLabel={(count) => count}
        laneActions={(lane) =>
          manage && (
            <button
              type="button"
              onClick={() => setEditing(columns.find((column) => column.id === lane.id) ?? null)}
              aria-label={t('board.columnMenu', { name: lane.title })}
              className="flex size-9 cursor-pointer items-center justify-center rounded-full text-text-2 hover:bg-surface focus-visible:outline-2 focus-visible:outline-focus"
            >
              <Icon name="more" size={18} />
            </button>
          )
        }
        laneFooter={(lane) =>
          manage && (
            <button
              type="button"
              onClick={() => setAdding(columns.find((column) => column.id === lane.id) ?? null)}
              className="mx-2.5 mb-2.5 flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-xl text-[13px] font-semibold text-text-2 shadow-[inset_0_0_0_1px_var(--line-2)] hover:bg-surface hover:text-text focus-visible:outline-2 focus-visible:outline-focus"
            >
              <Icon name="plus" size={16} />
              {t('board.addTask')}
            </button>
          )
        }
        after={
          manage &&
          columns.length < MAX_COLUMNS && (
            <button
              type="button"
              onClick={() => setNaming(true)}
              className="flex min-h-28 cursor-pointer items-center justify-center gap-1.5 self-start rounded-2xl font-bold text-text-2 shadow-[inset_0_0_0_1px_var(--line-2)] hover:bg-surface hover:text-text focus-visible:outline-2 focus-visible:outline-focus"
            >
              <Icon name="plus" size={18} />
              {t('board.newColumn')}
            </button>
          )
        }
      />
      {editing && (
        <ColumnDialog
          key={editing.id}
          panel={panel}
          scope={scope}
          column={editing}
          columns={columns}
          onClose={() => setEditing(null)}
        />
      )}
      <NewColumnDialog panel={panel} scope={scope} open={naming} onClose={() => setNaming(false)} />
      {adding && (
        <AddTaskDialog
          panel={panel}
          scope={scope}
          column={adding}
          onClose={() => setAdding(null)}
        />
      )}
      {opened && (
        <CardDialog
          key={opened.id}
          panel={panel}
          scope={scope}
          manage={manage}
          card={opened}
          columns={columns}
          onClose={() => setOpened(null)}
        />
      )}
    </>
  );
}

/** A card's face: its task, a tag (whose, late, done) and when it is due; it opens the card's window. */
function CardFace({ card, now, onOpen }: { card: BoardCard; now: number; onOpen: () => void }) {
  const { t } = useTranslation('tasks');
  const f = useFormat();
  const { task } = card;
  const late = !task.done && new Date(task.due_at).getTime() < now;
  const tag = task.done ? 'done' : late ? 'late' : task.kind === 'mine' ? 'mine' : 'request';
  const tone = {
    done: 'bg-good-tint text-good',
    late: 'bg-warn-tint text-urgent',
    mine: 'bg-neutral-tint text-text-2',
    request: 'bg-tint text-primary-text',
  }[tag];
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={t('board.openCard', { text: task.text })}
      className="flex w-full cursor-pointer flex-col gap-2 rounded-xl bg-surface p-3 pe-11 text-start shadow-board-card hover:shadow-[inset_0_0_0_1px_var(--line-3)] focus-visible:outline-2 focus-visible:outline-focus"
    >
      <span
        className={`text-sm leading-7 font-bold [overflow-wrap:anywhere] ${task.done ? 'text-text-2 line-through' : ''}`}
      >
        {task.text}
      </span>
      <span className="flex flex-wrap items-center justify-between gap-1.5">
        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${tone}`}>
          {t(`board.tag.${tag}`)}
        </span>
        <span className="text-xs text-text-2">
          {card.who && `${card.who} · `}
          {task.timed
            ? t('board.due', { day: f.dateShort(task.due_at), time: f.time(task.due_at) })
            : t('board.dueDay', { day: f.dateShort(task.due_at) })}
        </span>
      </span>
    </button>
  );
}

/** 6B: no columns yet. Name the first one, or start with the three suggested. */
function EmptyBoard({ panel, scope }: { panel: BoardPanel; scope: BoardScope }) {
  const { t } = useTranslation('tasks');
  const change = useColumnChange(panel, scope);
  const start = () =>
    change.mutate(
      {
        kind: 'add',
        names: [
          t('board.suggested.today'),
          t('board.suggested.week'),
          t('board.suggested.waiting'),
        ],
      },
      { onError: () => toast.error(t('board.failed')) },
    );
  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-board p-4 lg:p-6">
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div className="grid gap-3.5 sm:grid-cols-3">
          <div className="rounded-2xl bg-board-lane p-3.5 shadow-[inset_0_0_0_2px_var(--focus)]">
            <ColumnForm panel={panel} scope={scope} />
          </div>
          <span
            aria-hidden="true"
            className="min-h-44 rounded-2xl shadow-[inset_0_0_0_1px_var(--line-2)] max-sm:hidden"
          />
          <span
            aria-hidden="true"
            className="min-h-44 rounded-2xl opacity-60 shadow-[inset_0_0_0_1px_var(--line-2)] max-sm:hidden"
          />
        </div>
        <aside className="flex max-w-md flex-col gap-3.5 rounded-card bg-hero p-6 text-on-hero">
          <h2 className="m-0 font-display text-lead font-bold">{t('board.empty.title')}</h2>
          <p className="m-0 text-sm leading-7 text-on-hero-2">{t('board.empty.text')}</p>
          <ul className="m-0 flex list-none flex-col gap-2.5 p-0 text-sm">
            {EMPTY_POINTS.map((point) => (
              <li key={point} className="flex items-center gap-2.5">
                <span
                  aria-hidden="true"
                  className="size-2 flex-none rounded-full bg-hero-current"
                />
                {t(`board.empty.${point}`)}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={start}
            disabled={change.isPending}
            className="inline-flex min-h-11 cursor-pointer items-center self-start rounded-full bg-hero-raised px-5 text-sm font-bold text-on-hero hover:brightness-110 focus-visible:outline-2 focus-visible:outline-focus disabled:opacity-60"
          >
            {t('board.empty.start')}
          </button>
        </aside>
      </div>
    </div>
  );
}

/** A new column's name (the empty board's form and the new-column window). */
function ColumnForm({
  panel,
  scope,
  onDone,
}: {
  panel: BoardPanel;
  scope: BoardScope;
  onDone?: () => void;
}) {
  const { t } = useTranslation('tasks');
  const change = useColumnChange(panel, scope);
  const [name, setName] = useState('');
  const [checked, setChecked] = useState(false);
  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setChecked(true);
    if (!name.trim()) return;
    change.mutate(
      { kind: 'add', names: [name.trim()] },
      { onSuccess: () => onDone?.(), onError: () => toast.error(t('board.failed')) },
    );
  };
  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-3">
      <TextField
        label={t('board.columnName')}
        value={name}
        maxLength={60}
        onChange={(event) => setName(event.target.value)}
        error={checked && !name.trim() ? t('board.nameRequired') : undefined}
      />
      <Button type="submit" disabled={change.isPending}>
        {t('board.create')}
      </Button>
    </form>
  );
}

function NewColumnDialog({
  panel,
  scope,
  open,
  onClose,
}: {
  panel: BoardPanel;
  scope: BoardScope;
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation('tasks');
  return (
    <Dialog open={open} onClose={onClose} title={t('board.newColumn')} closeLabel={t('close')}>
      {open && <ColumnForm panel={panel} scope={scope} onDone={onClose} />}
    </Dialog>
  );
}

/** A column's window: rename it, move it earlier or later, or delete it (its cards; not their tasks). */
function ColumnDialog({
  panel,
  scope,
  column,
  columns,
  onClose,
}: {
  panel: BoardPanel;
  scope: BoardScope;
  column: BoardColumn;
  columns: BoardColumn[];
  onClose: () => void;
}) {
  const { t } = useTranslation('tasks');
  const change = useColumnChange(panel, scope);
  const [name, setName] = useState(column.name);
  const [deleting, setDeleting] = useState(false);
  const at = columns.findIndex((item) => item.id === column.id);
  const ids = columns.map((item) => item.id);
  const shift = (by: -1 | 1) => {
    const next = [...ids];
    next.splice(at, 1);
    next.splice(at + by, 0, column.id);
    change.mutate({ kind: 'order', ids: next }, { onError: () => toast.error(t('board.failed')) });
  };
  const fail = () => toast.error(t('board.failed'));
  return (
    <Dialog
      open
      onClose={onClose}
      title={t('board.columnTitle', { name: column.name })}
      closeLabel={t('close')}
    >
      <div className="flex flex-col gap-6">
        <form
          noValidate
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (!name.trim()) return;
            change.mutate(
              { kind: 'rename', id: column.id, name: name.trim() },
              { onSuccess: onClose, onError: fail },
            );
          }}
        >
          <TextField
            label={t('board.columnName')}
            value={name}
            maxLength={60}
            onChange={(event) => setName(event.target.value)}
            error={!name.trim() ? t('board.nameRequired') : undefined}
          />
          <Button type="submit" disabled={change.isPending}>
            {t('board.save')}
          </Button>
        </form>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={at === 0 || change.isPending}
            onClick={() => shift(-1)}
          >
            {t('board.earlier')}
          </Button>
          <Button
            variant="outline"
            disabled={at === columns.length - 1 || change.isPending}
            onClick={() => shift(1)}
          >
            {t('board.later')}
          </Button>
        </div>
        <div className="flex flex-col gap-2 rounded-card-sm bg-warn-tint p-4">
          <p className="m-0 text-sm leading-7">
            {t('board.deleteHint', { n: column.cards.length })}
          </p>
          <Button
            variant={deleting ? 'danger' : 'outline'}
            disabled={change.isPending}
            className="self-start"
            onClick={() =>
              deleting
                ? change.mutate(
                    { kind: 'remove', id: column.id },
                    { onSuccess: onClose, onError: fail },
                  )
                : setDeleting(true)
            }
          >
            {t(deleting ? 'board.deleteSure' : 'board.delete')}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

/** «+ گذاشتن یکی از کارهایم»: my open tasks not on the board, found by text, into this column. */
function AddTaskDialog({
  panel,
  scope,
  column,
  onClose,
}: {
  panel: BoardPanel;
  scope: BoardScope;
  column: BoardColumn;
  onClose: () => void;
}) {
  const { t } = useTranslation('tasks');
  const f = useFormat();
  const [text, setText] = useState('');
  const typed = text.trim();
  const search = useDebouncedValue(typed.length >= SEARCH_MIN ? typed : '');
  const found = useQuery(candidatesQuery(panel, search, scope));
  const add = useCardChange(panel, scope);
  const put = (task: BoardTask) =>
    add.mutate(
      { kind: 'add', column: column.id, task: task.id },
      {
        onSuccess: () => toast.success(t('board.added', { name: column.name })),
        onError: () => toast.error(t('board.failed')),
      },
    );
  return (
    <Dialog
      open
      onClose={onClose}
      title={t('board.addTitle', { name: column.name })}
      subtitle={t('board.addHint')}
      closeLabel={t('close')}
    >
      <div className="flex flex-col gap-4">
        <SearchField
          label={t('board.search')}
          placeholder={t('board.search')}
          value={text}
          onChange={setText}
          className="w-full"
        />
        {found.isPending ? (
          <p className="m-0 text-sm text-text-2">{t('board.loading')}</p>
        ) : (found.data ?? []).length === 0 ? (
          <p className="m-0 text-sm text-text-2">{t('board.noCandidates')}</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {(found.data ?? []).map((task) => (
              <li key={task.id}>
                <button
                  type="button"
                  disabled={add.isPending}
                  onClick={() => put(task)}
                  className="flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2 text-start shadow-[inset_0_0_0_1px_var(--line-2)] hover:bg-tint focus-visible:outline-2 focus-visible:outline-focus disabled:opacity-60"
                >
                  <span className="min-w-0 text-sm font-semibold [overflow-wrap:anywhere]">
                    {task.text}
                  </span>
                  <span className="flex-none text-xs text-text-2">{f.dateShort(task.due_at)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Dialog>
  );
}

/** A card's window: its task (open it on the tasks page), its column, or off the board. */
function CardDialog({
  panel,
  scope,
  manage,
  card,
  columns,
  onClose,
}: {
  panel: BoardPanel;
  scope: BoardScope;
  /** Takes cards off (the team board: its admin). */
  manage: boolean;
  card: BoardCard;
  columns: BoardColumn[];
  onClose: () => void;
}) {
  const { t } = useTranslation('tasks');
  const change = useCardChange(panel, scope);
  const fail = () => toast.error(t('board.failed'));
  return (
    <Dialog
      open
      onClose={onClose}
      title={card.task.text}
      subtitle={t('board.cardHint')}
      closeLabel={t('close')}
    >
      <div className="flex flex-col gap-5">
        {card.can_move && (
          <SelectField
            label={t('board.column')}
            value={String(card.column)}
            onChange={(value) =>
              change.mutate(
                { kind: 'move', card: card.id, column: Number(value), before: null },
                { onSuccess: onClose, onError: fail },
              )
            }
            options={columns.map((column) => ({ value: String(column.id), label: column.name }))}
          />
        )}
        <div className="flex flex-wrap gap-2">
          <Link
            to={taskHref(panel, card.task.id)}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-primary px-5 text-sm font-bold text-on-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            {t('board.openTask')}
          </Link>
          {manage && (
            <Button
              variant="outline"
              disabled={change.isPending}
              onClick={() =>
                change.mutate(
                  { kind: 'remove', card: card.id },
                  { onSuccess: onClose, onError: fail },
                )
              }
            >
              {t('board.remove')}
            </Button>
          )}
        </div>
      </div>
    </Dialog>
  );
}
