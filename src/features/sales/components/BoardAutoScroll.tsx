import { useDndMonitor } from '@dnd-kit/core';
import { useEffect, useMemo, type RefObject } from 'react';
import { createBoardAutoScroller } from '../boardAutoScroll';

/** Pointer scrolling uses raw client coordinates, so scrolling cannot move its own edge trigger. */
export function BoardAutoScroll({ board }: { board: RefObject<HTMLDivElement | null> }) {
  const scroller = useMemo(() => createBoardAutoScroller(() => board.current), [board]);
  useEffect(() => () => scroller.stop(), [scroller]);
  useDndMonitor({
    onDragStart: ({ activatorEvent }) => scroller.start(activatorEvent),
    onDragEnd: () => scroller.stop(),
    onDragCancel: () => scroller.stop(),
  });
  return null;
}
