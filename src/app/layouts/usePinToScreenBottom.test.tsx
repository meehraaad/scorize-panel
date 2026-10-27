import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { usePinToScreenBottom } from './usePinToScreenBottom';

function setup(
  viewport: { height: number; offsetTop?: number; scale?: number },
  barBottom: number,
) {
  const target = new EventTarget();
  vi.stubGlobal('visualViewport', Object.assign(target, { offsetTop: 0, scale: 1, ...viewport }));
  const bar = document.createElement('nav');
  bar.getBoundingClientRect = () => ({ bottom: barBottom, height: 72 }) as DOMRect;
  renderHook(() => usePinToScreenBottom({ current: bar }));
  return bar;
}

describe('usePinToScreenBottom', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('moves the bar down to the screen bottom when the browser leaves a gap under it', () => {
    expect(setup({ height: 800 }, 720).style.transform).toBe('translateY(80px)');
  });

  it('leaves the bar alone when it already sits on the bottom', () => {
    expect(setup({ height: 800 }, 800).style.transform).toBe('');
  });

  it('never moves it up (keyboard) or while zoomed in', () => {
    expect(setup({ height: 400 }, 800).style.transform).toBe('');
    expect(setup({ height: 400, scale: 2 }, 300).style.transform).toBe('');
  });
});
