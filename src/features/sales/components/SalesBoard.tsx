import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { memo, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Button } from '@/components/ui/Button';
import { ChoiceGroup } from '@/components/ui/Choices';
import { Dialog } from '@/components/ui/Dialog';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { useFormat } from '@/lib/i18n/useFormat';
import { toast } from '@/lib/toast';
import {
  MOVABLE_STAGES,
  isMovableStage,
  useMoveBoardCard,
  type BoardCard,
  type BoardData,
  type MovableStage,
} from '../api';
import { boardCollisionDetection, boardCoordinates } from '../boardDrag';
import { useBoardOrder, type BoardStage } from '../boardOrder';
import { useSalesFormat } from '../format';
import { salesPath } from '../paths';
import { DealCard } from './DealCard';

const MemoDealCard = memo(DealCard);
const MemoIconButton = memo(IconButton);
type PickedCard = { card: BoardCard; stage: BoardStage };

export function SalesBoard({ data: serverData, ownerId }: { data: BoardData; ownerId: number }) {
  const order = useBoardOrder(ownerId, serverData);
  const data = order.data;
  const { t } = useTranslation('sales');
  const f = useFormat();
  const mutation = useMoveBoardCard();
  const busy = useRef(false);
  const board = useRef<HTMLDivElement>(null);
  const restoreLead = useRef<number | null>(null);
  const [active, setActive] = useState<PickedCard | null>(null);
  const [picked, setPicked] = useState<PickedCard | null>(null);
  const [destination, setDestination] = useState<MovableStage | null>(null);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // Long press the handle; moving before activation preserves ordinary touch scrolling.
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: boardCoordinates,
      keyboardCodes: { start: ['Space'], cancel: ['Escape', 'Tab'], end: ['Space', 'Enter'] },
      scrollBehavior: 'auto',
    }),
  );
  const findCard = (id: string | number): PickedCard | null => {
    for (const column of data.columns) {
      const card = column.cards.find((item) => item.lead === id);
      if (card) return { card, stage: column.stage };
    }
    return null;
  };
  const nameOf = (id: string | number) => findCard(id)?.card.name ?? '';
  const stageOf = (id: string | number) => {
    const stage =
      typeof id === 'number'
        ? findCard(id)?.stage
        : data.columns.find((column) => column.stage === id)?.stage;
    return stage ? t(`stage.${stage}`) : '';
  };

  function targetOf(id: string | number) {
    const stage = typeof id === 'number' ? findCard(id)?.stage : id;
    const column = data.columns.find((column) => column.stage === stage);
    return column
      ? {
          stage: column.stage,
          index:
            typeof id === 'number'
              ? column.cards.findIndex((card) => card.lead === id)
              : column.cards.length - 1,
        }
      : null;
  }

  function move(item: PickedCard, to: MovableStage) {
    if (busy.current || item.stage === to || !isMovableStage(item.stage)) return;
    busy.current = true;
    mutation.mutate(
      { lead: item.card.lead, from: item.stage, to },
      {
        onSuccess: () =>
          toast.success(t('board.move.saved', { name: item.card.name, stage: t(`stage.${to}`) })),
        onError: () => toast.error(t('board.move.failed', { name: item.card.name })),
        onSettled: () => {
          busy.current = false;
          restoreLead.current = item.card.lead;
        },
      },
    );
  }

  function reorder(item: PickedCard, to: number) {
    if (busy.current) return;
    const cards = data.columns.find((column) => column.stage === item.stage)?.cards;
    if (!cards) return;
    const from = cards.findIndex((card) => card.lead === item.card.lead);
    if (from < 0 || to < 0 || to >= cards.length || from === to) return;
    if (
      !order.save(
        item.stage,
        arrayMove(cards, from, to).map((card) => card.lead),
      )
    ) {
      restoreLead.current = null;
      toast.error(t('board.order.failed'));
      return;
    }
    toast.success(t('board.order.saved', { name: item.card.name, position: f.number(to + 1) }));
  }
  const pickedCards = data.columns.find((column) => column.stage === picked?.stage)?.cards ?? [];
  const pickedIndex = pickedCards.findIndex((card) => card.lead === picked?.card.lead);

  // Query reconciliation can replace the card again. Focus after both DOM updates commit.
  useEffect(() => {
    if (mutation.isPending || restoreLead.current === null) return;
    const frame = requestAnimationFrame(() => {
      const lead = restoreLead.current;
      if (lead === null) return;
      restoreLead.current = null;
      const focused = document.activeElement;
      if (focused === document.body || focused?.getAttribute('data-move-lead') === String(lead)) {
        board.current
          ?.querySelector<HTMLButtonElement>(`[data-move-lead="${String(lead)}"]`)
          ?.focus({ preventScroll: true });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [mutation.isPending, data]);

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={boardCollisionDetection}
        accessibility={{
          restoreFocus: false,
          screenReaderInstructions: { draggable: t('board.move.instructions') },
          announcements: {
            onDragStart: ({ active }) => t('board.move.pickedUp', { name: nameOf(active.id) }),
            onDragOver: ({ over }) => {
              const item = over && typeof over.id === 'number' ? findCard(over.id) : null;
              const cards = data.columns.find((column) => column.stage === item?.stage)?.cards;
              return item && cards
                ? t('board.order.over', {
                    stage: stageOf(item.card.lead),
                    position: f.number(cards.findIndex((card) => card.lead === item.card.lead) + 1),
                  })
                : over
                  ? t('board.move.over', { stage: stageOf(over.id) })
                  : t('board.move.outside');
            },
            onDragEnd: ({ active, over }) => {
              const item = findCard(active.id);
              const target = over && targetOf(over.id);
              if (!item || !target) return t('board.move.cancelled');
              if (item.stage !== target.stage)
                return t('board.move.dropped', { name: item.card.name, stage: stageOf(over.id) });
              const from = data.columns
                .find((column) => column.stage === item.stage)
                ?.cards.findIndex((card) => card.lead === item.card.lead);
              return from !== target.index ? t('board.order.dropped') : t('board.move.cancelled');
            },
            onDragCancel: () => t('board.move.cancelled'),
          },
        }}
        onDragStart={({ active }) => {
          setActive(findCard(active.id));
        }}
        onDragCancel={() => setActive(null)}
        onDragEnd={({ active, over }) => {
          setActive(null);
          const item = findCard(active.id);
          if (!item || !over) return;
          const target = targetOf(over.id);
          if (!target) return;
          if (target.stage === item.stage) reorder(item, target.index);
          else if (isMovableStage(target.stage)) move(item, target.stage);
        }}
      >
        <div
          ref={board}
          aria-busy={mutation.isPending}
          className="min-h-0 min-w-0 flex-1 overflow-x-auto overflow-y-hidden overscroll-x-contain bg-board px-4 pt-4 pb-3 [contain:layout_paint] lg:px-6 lg:pt-5"
        >
          <div className="grid h-full min-w-full auto-cols-[minmax(264px,1fr)] grid-flow-col items-stretch gap-3 pb-1 lg:auto-cols-[minmax(288px,1fr)] lg:gap-4">
            {data.columns.map((column) => (
              <BoardColumn key={column.stage} column={column} disabled={mutation.isPending}>
                <SortableContext
                  items={column.cards.map((card) => card.lead)}
                  strategy={verticalListSortingStrategy}
                >
                  {column.cards.map((card) => (
                    <DraggableDeal
                      key={card.lead}
                      card={card}
                      stage={column.stage}
                      disabled={mutation.isPending}
                      pending={mutation.isPending && mutation.variables.lead === card.lead}
                      onPick={() => {
                        if (busy.current) return;
                        setPicked({ card, stage: column.stage });
                        setDestination(null);
                      }}
                    />
                  ))}
                </SortableContext>
              </BoardColumn>
            ))}
          </div>
        </div>
        {createPortal(
          <DragOverlay
            dropAnimation={null}
            transition=""
            style={{ willChange: 'transform' }}
            zIndex={50}
          >
            {active && (
              <div aria-hidden="true" className="pointer-events-none cursor-grabbing">
                <div className="flex h-full flex-col gap-3 rounded-xl border border-primary bg-surface p-4 text-text shadow-board-card ring-2 ring-primary">
                  <span className="text-[15px] font-semibold">{active.card.name}</span>
                  <span className="text-[13px] leading-6 text-text-2">{active.card.summary}</span>
                  <span className="text-xs text-text-2">{t(`stage.${active.stage}`)}</span>
                </div>
              </div>
            )}
          </DragOverlay>,
          document.body,
        )}
      </DndContext>
      <Dialog
        open={picked !== null}
        onClose={() => setPicked(null)}
        title={t('board.move.title', { name: picked?.card.name ?? '' })}
        closeLabel={t('close')}
        subtitle={t('board.move.hint')}
        footer={
          isMovableStage(picked?.stage) ? (
            <Button
              disabled={!destination || mutation.isPending}
              onClick={() => {
                if (destination) {
                  move(picked, destination);
                  setPicked(null);
                }
              }}
            >
              {t('board.move.save')}
            </Button>
          ) : undefined
        }
      >
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={pickedIndex <= 0 || mutation.isPending}
            onClick={() => {
              if (picked) reorder(picked, pickedIndex - 1);
              setPicked(null);
            }}
          >
            {t('board.order.up')}
          </Button>
          <Button
            variant="outline"
            disabled={
              pickedIndex < 0 || pickedIndex >= pickedCards.length - 1 || mutation.isPending
            }
            onClick={() => {
              if (picked) reorder(picked, pickedIndex + 1);
              setPicked(null);
            }}
          >
            {t('board.order.down')}
          </Button>
        </div>
        <p className="m-0 text-sm text-text-2">{t('board.order.scope')}</p>
        {isMovableStage(picked?.stage) && (
          <ChoiceGroup
            legend={t('board.move.destination')}
            value={destination}
            onChange={setDestination}
            options={MOVABLE_STAGES.filter((stage) => stage !== picked.stage).map((stage) => ({
              value: stage,
              label: t(`stage.${stage}`),
            }))}
          />
        )}
      </Dialog>
    </>
  );
}

const STAGE_DOT: Record<BoardData['columns'][number]['stage'], string> = {
  new: 'bg-info',
  contacted: 'bg-warn',
  consulted: 'bg-primary',
  offer: 'bg-hero-accent',
  draft: 'bg-urgent',
  won: 'bg-good',
};

function BoardColumn({
  column,
  disabled,
  children,
}: {
  column: BoardData['columns'][number];
  disabled: boolean;
  children: React.ReactNode;
}) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const s = useSalesFormat();
  const movable = isMovableStage(column.stage);
  const { setNodeRef, isOver, over } = useDroppable({
    id: column.stage,
    disabled,
    data: { stage: column.stage, type: 'column' },
  });
  return (
    <section
      ref={setNodeRef}
      aria-labelledby={`col-${column.stage}`}
      className={`flex min-h-0 flex-col overflow-hidden rounded-2xl border border-hair bg-board-lane ${isOver || over?.data.current?.stage === column.stage ? 'ring-2 ring-primary ring-inset' : ''}`}
    >
      <div className="flex min-h-23 flex-none flex-col justify-center gap-2 px-4 pt-3 pb-3">
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className={`size-2 flex-none rounded-full ${STAGE_DOT[column.stage]}`}
          />
          <h2 id={`col-${column.stage}`} className="m-0 flex-1 text-[13px] leading-5 font-semibold">
            {t(`stage.${column.stage}`)}
          </h2>
          {!movable && (
            <span title={t('board.move.managed')} className="text-text-2">
              <Icon name="lock" size={12} />
              <span className="sr-only">{t('board.move.managed')}</span>
            </span>
          )}
          <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-md border border-hair bg-surface px-1.5 text-[11px] font-medium text-text-2 tabular-nums">
            {f.number(column.count)}
          </span>
        </div>
        <span className="ps-4 text-[11px] text-text-2">
          {column.value === null ? t('board.noValue') : s.millions(column.value)}
        </span>
      </div>
      <ul
        className={`m-0 flex min-h-0 [scrollbar-width:thin] list-none flex-col gap-2.5 overflow-y-auto overscroll-y-contain px-2.5 pb-2.5 ${column.cards.length ? 'flex-1' : 'flex-none'}`}
      >
        {children}
      </ul>
      {column.cards.length === 0 && (
        <div className="mx-2.5 mb-auto flex min-h-32 flex-none flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line-2 p-4 text-center text-text-2">
          <Icon name={column.stage === 'won' ? 'check' : 'grid'} size={18} />
          <p className="m-0 text-xs">{t('board.move.empty')}</p>
        </div>
      )}
      {column.count > column.cards.length && (
        <Link
          to={salesPath(`leads?stage=${column.stage}`)}
          className="mx-2.5 mb-2.5 inline-flex min-h-11 flex-none items-center justify-center gap-2 rounded-lg border border-dashed border-line-2 text-xs font-medium text-text-2 hover:border-line-3 hover:bg-surface"
        >
          {t('board.more', { n: f.number(column.count - column.cards.length) })}
          <Icon name="chevronEnd" size={14} />
        </Link>
      )}
    </section>
  );
}

function DraggableDeal({
  card,
  stage,
  disabled,
  pending,
  onPick,
}: {
  card: BoardCard;
  stage: BoardData['columns'][number]['stage'];
  disabled: boolean;
  pending: boolean;
  onPick: () => void;
}) {
  const { t } = useTranslation('sales');
  const {
    setNodeRef,
    setActivatorNodeRef,
    attributes,
    listeners,
    isDragging,
    transform,
    transition,
  } = useSortable({
    id: card.lead,
    disabled,
    data: { stage, type: 'card' },
    attributes: { roleDescription: t('board.move.card') },
  });
  return (
    <li
      ref={setNodeRef}
      style={{
        transform: transform
          ? `translate3d(${String(transform.x)}px, ${String(transform.y)}px, 0)`
          : undefined,
        transition,
        willChange: transform ? 'transform' : undefined,
      }}
      className={`relative flex-none ${isDragging ? 'opacity-30' : ''}`}
    >
      <MemoDealCard card={card} />
      <MemoIconButton
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        icon="grip"
        aria-label={t('board.move.title', { name: card.name })}
        data-move-lead={card.lead}
        disabled={disabled}
        onClick={onPick}
        className="absolute end-0.5 top-0.5 cursor-grab touch-pan-y text-text-2 active:cursor-grabbing"
      />
      {pending && (
        <span role="status" className="block px-2 pt-1 text-xs text-text-2">
          {t('board.move.saving')}
        </span>
      )}
    </li>
  );
}
