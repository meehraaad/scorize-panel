import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBoardAutoScroller, edgeScrollSpeed } from './boardAutoScroll';

function bounds(left: number, top: number, width: number, height: number): DOMRect {
  return {
    x: left,
    y: top,
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    toJSON() {},
  };
}
let board: HTMLDivElement;
let first: HTMLUListElement;
let second: HTMLUListElement;
let callbacks: Map<number, FrameRequestCallback>;
let scroller: ReturnType<typeof createBoardAutoScroller>;
let now: number;
function frame(delta = 16) {
  now += delta;
  const pending = [...callbacks.values()];
  callbacks.clear();
  pending.forEach((callback) => callback(now));
}
function mouse(x: number, y: number) {
  return new MouseEvent('mousemove', { clientX: x, clientY: y });
}
function move(x: number, y: number) {
  window.dispatchEvent(mouse(x, y));
}
function scrollBox(
  element: HTMLElement,
  width: number,
  height: number,
  extraX: number,
  extraY: number,
  rtl = false,
) {
  Object.defineProperties(element, {
    clientWidth: { value: width },
    scrollWidth: { value: width + extraX },
    clientHeight: { value: height },
    scrollHeight: { value: height + extraY },
  });
  element.scrollBy = vi.fn((optionsOrX?: ScrollToOptions | number, y?: number) => {
    const options =
      typeof optionsOrX === 'number' ? { left: optionsOrX, top: y ?? 0 } : (optionsOrX ?? {});
    element.scrollLeft = Math.max(
      rtl ? -extraX : 0,
      Math.min(rtl ? 0 : extraX, element.scrollLeft + (options.left ?? 0)),
    );
    element.scrollTop = Math.max(0, Math.min(extraY, element.scrollTop + (options.top ?? 0)));
  });
}

beforeEach(() => {
  document.body.innerHTML =
    '<div><section data-board-lane><ul data-board-cards></ul></section><section data-board-lane><ul data-board-cards></ul></section></div>';
  board = document.body.querySelector('div') as HTMLDivElement;
  const lists = board.querySelectorAll('ul');
  first = lists[0] as HTMLUListElement;
  second = lists[1] as HTMLUListElement;
  scrollBox(board, 600, 500, 600, 0);
  scrollBox(first, 280, 350, 0, 800);
  scrollBox(second, 280, 350, 0, 800);
  board.getBoundingClientRect = () => bounds(0, 100, 600, 500);
  const sections = board.querySelectorAll('section');
  if (sections[0]) sections[0].getBoundingClientRect = () => bounds(10, 110, 280, 480);
  if (sections[1]) sections[1].getBoundingClientRect = () => bounds(310, 110, 280, 480);
  first.getBoundingClientRect = () => bounds(10, 200, 280, 350);
  second.getBoundingClientRect = () => bounds(310, 200, 280, 350);
  callbacks = new Map();
  now = 0;
  let next = 0;
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    callbacks.set(++next, callback);
    return next;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
    callbacks.delete(id);
  });
  scroller = createBoardAutoScroller(() => board);
});
afterEach(() => {
  scroller.stop();
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('board drag edge scrolling', () => {
  it('continues horizontally while the pointer is stationary, and reverses at the opposite edge', () => {
    scroller.start(mouse(595, 350));
    frame();
    const initial = board.scrollLeft;
    frame();
    frame();
    expect(board.scrollLeft).toBeGreaterThan(initial);
    const beforeReverse = board.scrollLeft;
    move(5, 350);
    frame();
    expect(board.scrollLeft).toBeLessThan(beforeReverse);
    move(300, 350);
    frame();
    const stopped = board.scrollLeft;
    expect(callbacks.size).toBe(0);
    frame();
    expect(board.scrollLeft).toBe(stopped);
  });

  it('scrolls the hovered lane vertically, independently of the original lane', () => {
    scroller.start(mouse(100, 350));
    frame();
    move(450, 540);
    frame();
    frame();
    expect(first.scrollTop).toBe(0);
    expect(second.scrollTop).toBeGreaterThan(0);
    move(450, 205);
    frame();
    expect(second.scrollTop).toBeLessThan(20);
  });

  it('can scroll both axes in the same frame without scrolling the document', () => {
    scroller.start(mouse(585, 545));
    frame();
    expect(board.scrollLeft).toBeGreaterThan(0);
    expect(second.scrollTop).toBeGreaterThan(0);
    expect(document.documentElement.scrollTop).toBe(0);
    expect(document.documentElement.scrollLeft).toBe(0);
  });

  it('uses physical scroll directions with negative RTL offsets', () => {
    // Modern browsers use negative offsets to reveal the left side of an RTL board.
    board.scrollBy = vi.fn((optionsOrX?: ScrollToOptions | number, y?: number) => {
      const options =
        typeof optionsOrX === 'number' ? { left: optionsOrX, top: y ?? 0 } : (optionsOrX ?? {});
      board.scrollLeft = Math.max(-600, Math.min(0, board.scrollLeft + (options.left ?? 0)));
    });
    scroller.start(mouse(5, 350));
    frame();
    frame();
    expect(board.scrollLeft).toBeLessThan(0);
    const left = board.scrollLeft;
    move(595, 350);
    frame();
    expect(board.scrollLeft).toBeGreaterThan(left);
  });

  it('goes idle at a limit or outside the board, and cancels scheduled frames on stop', () => {
    board.scrollLeft = 600;
    scroller.start(mouse(595, 350));
    frame();
    expect(callbacks.size).toBe(0);
    move(500, 750);
    frame();
    expect(callbacks.size).toBe(0);
    move(5, 350);
    expect(callbacks.size).toBe(1);
    scroller.stop();
    expect(callbacks.size).toBe(0);
    move(5, 350);
    expect(callbacks.size).toBe(0);
  });

  it('limits a delayed frame and stops on window blur', () => {
    scroller.start(mouse(599, 350));
    frame();
    const before = board.scrollLeft;
    frame(2000);
    expect(board.scrollLeft - before).toBeLessThanOrEqual(600 * 0.032);
    window.dispatchEvent(new Event('blur'));
    expect(callbacks.size).toBe(0);
  });

  it('ignores keyboard activation, which already scrolls its focused targets into view', () => {
    scroller.start(new KeyboardEvent('keydown', { code: 'Space' }));
    expect(callbacks.size).toBe(0);
  });

  it('ramps speed near the edge and stays still in the center', () => {
    expect(edgeScrollSpeed(300, 0, 600)).toBe(0);
    expect(edgeScrollSpeed(1, 0, 600)).toBeLessThan(edgeScrollSpeed(40, 0, 600));
    expect(edgeScrollSpeed(599, 0, 600)).toBeGreaterThan(edgeScrollSpeed(560, 0, 600));
  });
});
