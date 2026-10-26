import {
  closestCenter,
  pointerWithin,
  rectIntersection,
  type CollisionDetection,
  type KeyboardCoordinateGetter,
} from '@dnd-kit/core';
import { isMovableStage } from './api/board';

/** Contract stages can be sorted internally, but only the open stages accept a stage move. */
export const boardCollisionDetection: CollisionDetection = (args) => {
  const from: unknown = args.active.data.current?.stage;
  const droppableContainers = args.droppableContainers.filter((container) => {
    const to: unknown = container.data.current?.stage;
    return to === from || (isMovableStage(from) && isMovableStage(to));
  });
  const candidates = { ...args, droppableContainers };
  const hits = args.pointerCoordinates ? pointerWithin(candidates) : rectIntersection(candidates);
  const cards = hits.filter(({ id }) => typeof id === 'number');
  if (cards.length) {
    const ids = new Set(cards.map(({ id }) => id));
    return closestCenter({
      ...candidates,
      droppableContainers: droppableContainers.filter(({ id }) => ids.has(id)),
    });
  }
  return hits;
};

/** Up/Down visits cards. Left/Right visits physical columns, so RTL needs no special reversal. */
export const boardCoordinates: KeyboardCoordinateGetter = (
  event,
  { context, currentCoordinates },
) => {
  const vertical = event.code === 'ArrowUp' || event.code === 'ArrowDown';
  if (!vertical && event.code !== 'ArrowLeft' && event.code !== 'ArrowRight') return;
  event.preventDefault();
  const current = context.collisionRect;
  if (!current) return;
  const source: unknown = context.active?.data.current?.stage;
  const selected: unknown = context.over?.data.current?.stage ?? source;
  const centerX = current.left + current.width / 2;
  const centerY = current.top + current.height / 2;
  const candidates = context.droppableContainers
    .getEnabled()
    .flatMap((container) => {
      const stage: unknown = container.data.current?.stage;
      const type: unknown = container.data.current?.type;
      if (
        vertical
          ? type !== 'card' || stage !== selected
          : type !== 'column' ||
            !(stage === source || (isMovableStage(source) && isMovableStage(stage)))
      )
        return [];
      const rect = context.droppableRects.get(container.id);
      if (!rect) return [];
      const distance = vertical
        ? rect.top + rect.height / 2 - centerY
        : rect.left + rect.width / 2 - centerX;
      const forward = event.code === 'ArrowDown' || event.code === 'ArrowRight';
      return (forward ? distance > 1 : distance < -1)
        ? [{ rect, distance: Math.abs(distance), stage }]
        : [];
    })
    .sort((a, b) => a.distance - b.distance);
  let target = candidates[0]?.rect;
  if (!target) return;
  if (!vertical) {
    // Prefer a real card in that column, including when the columns have different card heights.
    const first = context.droppableContainers
      .getEnabled()
      .find(
        (container) =>
          container.data.current?.type === 'card' &&
          container.data.current.stage === candidates[0]?.stage,
      );
    target = (first && context.droppableRects.get(first.id)) ?? target;
  }
  return {
    x: currentCoordinates.x + target.left + target.width / 2 - centerX,
    y:
      currentCoordinates.y +
      (vertical || target.height < current.height * 2
        ? target.top + target.height / 2 - centerY
        : target.top - current.top + 16),
  };
};
