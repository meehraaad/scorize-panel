import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type KeyboardCoordinateGetter,
} from '@dnd-kit/core';
import { memo, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Button } from '@/components/ui/Button';
import { ChoiceGroup } from '@/components/ui/Choices';
import { Dialog } from '@/components/ui/Dialog';
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
import { useSalesFormat } from '../format';
import { salesPath } from '../paths';
import { DealCard } from './DealCard';

// Pointer drops must actually be inside a column. Keyboard dragging has no pointer.
const collisionDetection: CollisionDetection = (args) =>
  args.pointerCoordinates ? pointerWithin(args) : rectIntersection(args);

/** Navigate by physical column position so the arrow keys work in both RTL and LTR. */
const columnCoordinates: KeyboardCoordinateGetter = (event, { context, currentCoordinates }) => {
  if (event.code !== 'ArrowLeft' && event.code !== 'ArrowRight') return;
  event.preventDefault();
  const current = context.collisionRect;
  if (!current) return;
  const center = current.left + current.width / 2;
  const candidates = context.droppableContainers
    .getEnabled()
    .flatMap(({ id }) => {
      const rect = context.droppableRects.get(id);
      return rect ? [rect] : [];
    })
    .filter((rect) =>
      event.code === 'ArrowRight'
        ? rect.left + rect.width / 2 > center + 1
        : rect.left + rect.width / 2 < center - 1,
    );
  candidates.sort(
    (a, b) => Math.abs(a.left + a.width / 2 - center) - Math.abs(b.left + b.width / 2 - center),
  );
  const target = candidates[0];
  if (!target) return;
  return {
    x: currentCoordinates.x + target.left + target.width / 2 - center,
    y: currentCoordinates.y + target.top - current.top + 16,
  };
};

const MemoDealCard = memo(DealCard);
const MemoIconButton = memo(IconButton);
type PickedCard = { card: BoardCard; stage: MovableStage };

export function SalesBoard({ data }: { data: BoardData }) {
  const { t } = useTranslation('sales');
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
      coordinateGetter: columnCoordinates,
      keyboardCodes: { start: ['Space'], cancel: ['Escape', 'Tab'], end: ['Space', 'Enter'] },
      scrollBehavior: 'auto',
    }),
  );
  const findCard = (id: string | number): PickedCard | null => {
    for (const column of data.columns) {
      if (!isMovableStage(column.stage)) continue;
      const card = column.cards.find((item) => item.lead === id);
      if (card) return { card, stage: column.stage };
    }
    return null;
  };
  const nameOf = (id: string | number) => findCard(id)?.card.name ?? '';
  const stageOf = (id: string | number) => (isMovableStage(id) ? t(`stage.${id}`) : '');

  function move(item: PickedCard, to: MovableStage) {
    if (busy.current || item.stage === to) return;
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
      <p className="m-0 text-sm leading-6 text-text-2">{t('board.move.hint')}</p>
      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        accessibility={{
          restoreFocus: false,
          screenReaderInstructions: { draggable: t('board.move.instructions') },
          announcements: {
            onDragStart: ({ active }) => t('board.move.pickedUp', { name: nameOf(active.id) }),
            onDragOver: ({ over }) =>
              over ? t('board.move.over', { stage: stageOf(over.id) }) : t('board.move.outside'),
            onDragEnd: ({ active, over }) =>
              over && findCard(active.id)?.stage !== over.id
                ? t('board.move.dropped', { name: nameOf(active.id), stage: stageOf(over.id) })
                : t('board.move.cancelled'),
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
          if (item && over && isMovableStage(over.id)) move(item, over.id);
        }}
      >
        <div
          ref={board}
          aria-busy={mutation.isPending}
          className="-mx-4 overflow-x-auto overscroll-x-contain px-4 pb-2 lg:mx-0 lg:px-0"
        >
          <div className="grid min-w-[1320px] grid-cols-6 items-stretch gap-4">
            {data.columns.map((column) => (
              <BoardColumn key={column.stage} column={column} disabled={mutation.isPending}>
                {column.cards.map((card) => (
                  <DraggableDeal
                    key={card.lead}
                    card={card}
                    stage={column.stage}
                    disabled={mutation.isPending}
                    pending={mutation.isPending && mutation.variables.lead === card.lead}
                    onPick={() => {
                      if (busy.current || !isMovableStage(column.stage)) return;
                      setPicked({ card, stage: column.stage });
                      setDestination(null);
                    }}
                  />
                ))}
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
                <div className="flex h-full flex-col gap-3 rounded-[20px] bg-surface p-4 text-text shadow-panel ring-2 ring-primary">
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
          <Button
            disabled={!destination || mutation.isPending}
            onClick={() => {
              if (picked && destination) {
                move(picked, destination);
                setPicked(null);
              }
            }}
          >
            {t('board.move.save')}
          </Button>
        }
      >
        <ChoiceGroup
          legend={t('board.move.destination')}
          value={destination}
          onChange={setDestination}
          options={MOVABLE_STAGES.filter((stage) => stage !== picked?.stage).map((stage) => ({
            value: stage,
            label: t(`stage.${stage}`),
          }))}
        />
      </Dialog>
    </>
  );
}

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
  const { setNodeRef, isOver } = useDroppable({ id: column.stage, disabled: disabled || !movable });
  return (
    <section
      ref={setNodeRef}
      aria-labelledby={`col-${column.stage}`}
      className={`flex min-h-64 flex-col gap-3 rounded-card-sm p-3.5 ${
        column.stage === 'won' ? 'bg-good-tint' : column.stage === 'draft' ? 'bg-tint' : 'bg-track'
      } ${isOver ? 'ring-2 ring-primary ring-inset' : ''}`}
    >
      <div className="flex flex-col gap-1 px-1 pt-1 pb-2">
        <div className="flex items-center justify-between gap-2">
          <h2 id={`col-${column.stage}`} className="m-0 text-[15px] font-bold">
            {t(`stage.${column.stage}`)}
          </h2>
          <span className="text-sm text-text-2 tabular-nums">{f.number(column.count)}</span>
        </div>
        <span className="text-[13px] text-text-2">
          {column.value === null ? t('board.noValue') : s.millions(column.value)}
        </span>
        {!movable && (
          <span className="text-xs leading-5 text-text-2">{t('board.move.managed')}</span>
        )}
      </div>
      <ul className="m-0 flex min-h-24 list-none flex-col gap-3 p-0">{children}</ul>
      {column.cards.length === 0 && (
        <p className="m-0 px-1 text-sm text-text-2">{t('board.move.empty')}</p>
      )}
      {column.count > column.cards.length && (
        <Link
          to={salesPath(`leads?stage=${column.stage}`)}
          className="px-1 text-sm text-primary-text"
        >
          {t('board.more', { n: f.number(column.count - column.cards.length) })}
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
  const movable = isMovableStage(stage);
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, isDragging } = useDraggable({
    id: card.lead,
    disabled: disabled || !movable,
    attributes: { roleDescription: t('board.move.card') },
  });
  return (
    <li ref={setNodeRef} className={`relative ${isDragging ? 'opacity-30' : ''}`}>
      <MemoDealCard card={card} />
      {movable && (
        <MemoIconButton
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          icon="more"
          aria-label={t('board.move.title', { name: card.name })}
          data-move-lead={card.lead}
          disabled={disabled}
          onClick={onPick}
          className="absolute end-1 top-1 cursor-grab touch-pan-y active:cursor-grabbing"
        />
      )}
      {pending && (
        <span role="status" className="block px-2 pt-1 text-xs text-text-2">
          {t('board.move.saving')}
        </span>
      )}
    </li>
  );
}
