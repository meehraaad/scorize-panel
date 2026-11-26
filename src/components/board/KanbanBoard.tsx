import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
} from '@dnd-kit/core';
import { useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@/components/ui/Icon';
import { useFormat } from '@/lib/i18n/useFormat';

export interface KanbanLane {
  id: number;
  title: string;
  /** The lane's dot: a background token class (`bg-info`). */
  dot: string;
  /** Shown with a lock: why cards can't be dragged out of it ("Only the manager takes cards out"). */
  locked?: string | undefined;
  /** Cards at once; past it the count turns urgent. */
  limit?: number | null | undefined;
  /** A line under the title (what entering needs). */
  note?: string | undefined;
}

/**
 * Columns of cards, as a team board: each lane a region named by its title with its count (and
 * limit), cards dragged by their grip to another lane with a mouse or a finger. Keyboard and
 * screen-reader users move a card from its details (the card face is the page's own button), so the
 * grip is for pointers only. The page decides what a card looks like and what a drop does
 * (`onMove`, which may refuse it). `sortable`: a card dropped on another goes before it, in that
 * lane or its own (a personal board's order); dropped elsewhere in a lane, at its end.
 */
export function KanbanBoard<T extends { id: number }>({
  label,
  lanes,
  cards,
  laneOf,
  renderCard,
  canDrag,
  onMove,
  emptyText,
  limitLabel,
  busy = false,
  sortable = false,
  laneActions,
  laneFooter,
  after,
}: {
  label: string;
  lanes: readonly KanbanLane[];
  cards: readonly T[];
  laneOf: (card: T) => number;
  /** The card's face: a button or link that opens it. */
  renderCard: (card: T) => ReactNode;
  /** False: the card has no grip (not the viewer's to move from here). */
  canDrag?: (card: T) => boolean;
  /** `before`: the card it was dropped on (`sortable`); null at the lane's end. */
  onMove: (card: T, toLane: number, before: T | null) => void;
  emptyText: string;
  /** "3 of 6": a lane's count against its limit. */
  limitLabel: (count: string, limit: string) => string;
  busy?: boolean;
  sortable?: boolean;
  /** Beside a lane's count (its menu). */
  laneActions?: ((lane: KanbanLane) => ReactNode) | undefined;
  /** Under a lane's cards (add one). */
  laneFooter?: ((lane: KanbanLane) => ReactNode) | undefined;
  /** After the last lane (a new lane). */
  after?: ReactNode;
}) {
  const f = useFormat();
  const [active, setActive] = useState<T | null>(null);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  );
  const byId = new Map(cards.map((card) => [card.id, card]));
  // A card under the pointer wins over the lane around it.
  const collisions: CollisionDetection = (args) => {
    const hits = pointerWithin(args);
    const card = hits.find((hit) => String(hit.id).startsWith(CARD));
    return card ? [card] : hits;
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={sortable ? collisions : pointerWithin}
      onDragStart={({ active: picked }) => setActive(byId.get(Number(picked.id)) ?? null)}
      onDragCancel={() => setActive(null)}
      onDragEnd={({ active: picked, over }) => {
        setActive(null);
        const card = byId.get(Number(picked.id));
        if (!card || !over) return;
        const target = String(over.id).startsWith(CARD)
          ? byId.get(Number(String(over.id).slice(CARD.length)))
          : undefined;
        if (target) {
          if (target.id !== card.id) onMove(card, laneOf(target), target);
        } else if (sortable || Number(over.id) !== laneOf(card))
          onMove(card, Number(over.id), null);
      }}
    >
      {/* Paint containment keeps the lanes' width inside the scroller: without it a phone's page
          grows to the board's width in right-to-left layouts (the sales board does the same). */}
      <div
        role="region"
        aria-label={label}
        aria-busy={busy}
        className="min-h-0 min-w-0 flex-1 overflow-x-auto overflow-y-hidden overscroll-x-contain bg-board px-4 pt-4 pb-3 [contain:layout_paint] lg:px-6 lg:pt-5"
      >
        <div className="grid h-full min-w-full auto-cols-[minmax(264px,1fr)] grid-flow-col items-stretch gap-3 pb-1 lg:auto-cols-[minmax(280px,1fr)] lg:gap-4">
          {lanes.map((lane) => {
            const inLane = cards.filter((card) => laneOf(card) === lane.id);
            return (
              <Lane key={lane.id} lane={lane} count={inLane.length} disabled={busy}>
                <div className="flex flex-col gap-1.5 px-4 pb-3">
                  <div className="flex items-center gap-2">
                    <span
                      aria-hidden="true"
                      className={`size-2 flex-none rounded-full ${lane.dot}`}
                    />
                    <h2
                      id={`lane-${String(lane.id)}`}
                      className="m-0 flex-1 text-[13px] font-semibold"
                    >
                      {lane.title}
                    </h2>
                    {lane.locked && (
                      <span title={lane.locked} className="text-text-2">
                        <Icon name="lock" size={12} />
                        <span className="sr-only">{lane.locked}</span>
                      </span>
                    )}
                    {laneActions?.(lane)}
                    <span
                      className={`inline-flex h-6 min-w-6 items-center justify-center rounded-md border border-hair bg-surface px-1.5 text-[11px] font-medium tabular-nums ${
                        lane.limit && inLane.length > lane.limit ? 'text-urgent' : 'text-text-2'
                      }`}
                    >
                      {lane.limit
                        ? limitLabel(f.number(inLane.length), f.number(lane.limit))
                        : f.number(inLane.length)}
                    </span>
                  </div>
                  {lane.note && <span className="ps-4 text-[11px] text-text-2">{lane.note}</span>}
                </div>
                {inLane.length === 0 ? (
                  <div className="mx-2.5 mb-2.5 flex min-h-28 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line-2 p-4 text-center text-text-2">
                    <Icon name="grid" size={18} />
                    <p className="m-0 text-xs">{emptyText}</p>
                  </div>
                ) : (
                  <ul className="m-0 flex min-h-0 flex-1 [scrollbar-width:thin] list-none flex-col gap-2.5 overflow-y-auto overscroll-y-contain px-2.5 pb-2.5">
                    {inLane.map((card) => (
                      <DraggableCard
                        key={card.id}
                        id={card.id}
                        draggable={!busy && (canDrag?.(card) ?? true)}
                        droppable={sortable && !busy}
                        dragging={active?.id === card.id}
                      >
                        {renderCard(card)}
                      </DraggableCard>
                    ))}
                  </ul>
                )}
                {laneFooter?.(lane)}
              </Lane>
            );
          })}
          {after}
        </div>
      </div>
      {createPortal(
        <DragOverlay dropAnimation={null} zIndex={50}>
          {active && (
            <div aria-hidden="true" className="pointer-events-none rounded-xl ring-2 ring-primary">
              {renderCard(active)}
            </div>
          )}
        </DragOverlay>,
        document.body,
      )}
    </DndContext>
  );
}

function Lane({
  lane,
  count,
  disabled,
  children,
}: {
  lane: KanbanLane;
  count: number;
  disabled: boolean;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: lane.id, disabled });
  return (
    <section
      ref={setNodeRef}
      aria-labelledby={`lane-${String(lane.id)}`}
      data-count={count}
      className={`flex min-h-0 flex-col overflow-hidden rounded-2xl border border-hair bg-board-lane pt-3 ${
        isOver ? 'ring-2 ring-primary ring-inset' : ''
      }`}
    >
      {children}
    </section>
  );
}

/** A card's drop id (`sortable`): lanes are numbers. */
const CARD = 'card-';

function DraggableCard({
  id,
  draggable,
  droppable,
  dragging,
  children,
}: {
  id: number;
  draggable: boolean;
  droppable: boolean;
  dragging: boolean;
  children: ReactNode;
}) {
  const { setNodeRef, setActivatorNodeRef, attributes, listeners } = useDraggable({
    id,
    disabled: !draggable,
  });
  const drop = useDroppable({ id: `${CARD}${String(id)}`, disabled: !droppable });
  return (
    <li
      ref={(node) => {
        setNodeRef(node);
        drop.setNodeRef(node);
      }}
      className={`relative flex-none rounded-xl ${dragging ? 'opacity-30' : ''} ${
        drop.isOver && !dragging ? 'ring-2 ring-primary' : ''
      }`}
    >
      {children}
      {draggable && (
        <span
          ref={setActivatorNodeRef}
          {...listeners}
          {...attributes}
          // Pointers only: keyboards move a card from its details.
          tabIndex={-1}
          role="presentation"
          aria-hidden="true"
          className="absolute end-1 top-1 flex size-9 cursor-grab touch-none items-center justify-center rounded-lg text-text-2 hover:bg-canvas active:cursor-grabbing"
        >
          <Icon name="grip" size={18} />
        </span>
      )}
    </li>
  );
}
