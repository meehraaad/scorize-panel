const EDGE_SIZE = 64;
const MAX_SPEED = 600; // Pixels per second at the edge; independent of display refresh rate.
const OUTSIDE_MARGIN = 24;

type Point = { x: number; y: number };

/** Ease into the edge zone instead of abruptly jumping to full speed. */
export function edgeScrollSpeed(point: number, start: number, end: number): number {
  if (end <= start) return 0;
  const zone = Math.min(EDGE_SIZE, (end - start) / 3);
  if (point < start + zone) return -MAX_SPEED * Math.min(1, (start + zone - point) / zone) ** 2;
  if (point > end - zone) return MAX_SPEED * Math.min(1, (point - end + zone) / zone) ** 2;
  return 0;
}

function pointOf(event: Event): Point | null {
  if (event instanceof MouseEvent) return { x: event.clientX, y: event.clientY };
  if (typeof TouchEvent !== 'undefined' && event instanceof TouchEvent) {
    const touch = event.touches[0];
    return touch ? { x: touch.clientX, y: touch.clientY } : null;
  }
  return null;
}

/** Scroll only the board and the hovered lane. No React renders or writes to card data per frame. */
export function createBoardAutoScroller(getBoard: () => HTMLElement | null) {
  let point: Point | null = null;
  let frame: number | null = null;
  let previousTime: number | null = null;

  function schedule() {
    if (point && frame === null) frame = window.requestAnimationFrame(scroll);
  }

  function move(event: Event) {
    point = pointOf(event);
    schedule();
  }

  function stop() {
    if (frame !== null) window.cancelAnimationFrame(frame);
    frame = null;
    point = null;
    previousTime = null;
    window.removeEventListener('mousemove', move);
    window.removeEventListener('touchmove', move);
    window.removeEventListener('resize', schedule);
    window.removeEventListener('blur', stop);
  }

  function scroll(time: number) {
    frame = null;
    const board = getBoard();
    if (!board || !point) {
      stop();
      return;
    }
    const bounds = board.getBoundingClientRect();
    const left = Math.max(0, bounds.left);
    const right = Math.min(window.innerWidth, bounds.right);
    const top = Math.max(0, bounds.top);
    const bottom = Math.min(window.innerHeight, bounds.bottom);
    if (
      point.x < left - OUTSIDE_MARGIN ||
      point.x > right + OUTSIDE_MARGIN ||
      point.y < top - OUTSIDE_MARGIN ||
      point.y > bottom + OUTSIDE_MARGIN
    ) {
      previousTime = null;
      return;
    }
    const elapsed =
      previousTime === null ? 1 / 60 : Math.min(32, Math.max(0, time - previousTime)) / 1000;
    previousTime = time;
    const x =
      board.scrollWidth > board.clientWidth ? edgeScrollSpeed(point.x, left, right) * elapsed : 0;
    let lane: HTMLElement | null = null;
    for (const column of board.querySelectorAll<HTMLElement>('[data-board-lane]')) {
      const rect = column.getBoundingClientRect();
      if (point.x >= Math.max(left, rect.left) && point.x <= Math.min(right, rect.right)) {
        lane = column.querySelector<HTMLElement>('[data-board-cards]');
        break;
      }
    }
    const laneBounds = lane?.getBoundingClientRect();
    const y =
      lane && laneBounds && lane.scrollHeight > lane.clientHeight
        ? edgeScrollSpeed(
            point.y,
            Math.max(top, laneBounds.top),
            Math.min(bottom, laneBounds.bottom),
          ) * elapsed
        : 0;
    // Finish geometry reads before scroll writes, so layout is measured at most once per frame.
    const oldX = board.scrollLeft;
    const oldY = lane?.scrollTop;
    if (x) board.scrollBy({ left: x, behavior: 'instant' });
    if (y) lane?.scrollBy({ top: y, behavior: 'instant' });
    if (board.scrollLeft !== oldX || lane?.scrollTop !== oldY) schedule();
    else previousTime = null; // Idle in the center or at a limit until the pointer moves again.
  }

  function start(event: Event) {
    stop();
    point = pointOf(event);
    if (!point) return; // KeyboardSensor already scrolls its focused targets into view.
    window.addEventListener('mousemove', move, { passive: true });
    window.addEventListener('touchmove', move, { passive: true });
    window.addEventListener('resize', schedule);
    window.addEventListener('blur', stop);
    schedule();
  }

  return { start, stop };
}
