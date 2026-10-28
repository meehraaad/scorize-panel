import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { BOARD_STAGES, type BoardData } from './api/board';
import { boardOrderKey, useBoardOrder } from './boardOrder';

const board: BoardData = {
  open_value: 500,
  columns: BOARD_STAGES.map((stage) => ({
    stage,
    id: null,
    name: null,
    max_days: null,
    activities: [],
    count: stage === 'new' ? 3 : 0,
    value: 500,
    cards:
      stage === 'new'
        ? [1, 2, 3].map((lead) => ({
            lead,
            customer: lead,
            name: String(lead),
            score: 80,
            summary: '',
            amount: 100,
            paid: null,
            stage_since: '2026-01-01',
            seller: null,
            next: null,
          }))
        : [],
  })),
  lost: { total: 0, reasons: [] },
  sellers: [],
};
const ids = (data: BoardData) => data.columns[0]?.cards.map((card) => card.lead);
beforeEach(() => localStorage.clear());

describe('personal board order', () => {
  it('isolates accounts, including when the signed-in account changes without unmounting', () => {
    const { result, rerender } = renderHook(({ owner }) => useBoardOrder(owner, board), {
      initialProps: { owner: 3 },
    });
    act(() => {
      expect(result.current.save('new', [3, 1, 2])).toBe(true);
    });
    expect(ids(result.current.data)).toEqual([3, 1, 2]);
    expect(result.current.data.open_value).toBe(500);
    expect(result.current.data.columns[0]?.count).toBe(3);
    rerender({ owner: 4 });
    expect(ids(result.current.data)).toEqual([1, 2, 3]);
    rerender({ owner: 3 });
    expect(ids(result.current.data)).toEqual([3, 1, 2]);
  });

  it('puts newly arriving cards before the saved cards and ignores missing cards', () => {
    localStorage.setItem(boardOrderKey(3), JSON.stringify({ new: [900, 3, 1] }));
    const { result } = renderHook(() => useBoardOrder(3, board));
    expect(ids(result.current.data)).toEqual([2, 3, 1]);
  });

  it('keeps server ordering when stored JSON is corrupt and sanitizes invalid IDs', () => {
    localStorage.setItem(boardOrderKey(3), '{broken');
    const { result } = renderHook(() => useBoardOrder(3, board));
    expect(result.current.data).toBe(board);
    act(() => {
      localStorage.setItem(boardOrderKey(3), JSON.stringify({ new: [2, 2, '3', -1, null, 1, 3] }));
      window.dispatchEvent(new StorageEvent('storage', { key: boardOrderKey(3) }));
    });
    expect(ids(result.current.data)).toEqual([2, 1, 3]);
  });

  it('syncs changes and deletion from another browser tab', () => {
    const { result } = renderHook(() => useBoardOrder(3, board));
    act(() => {
      localStorage.setItem(boardOrderKey(3), JSON.stringify({ new: [3, 2, 1] }));
      window.dispatchEvent(new StorageEvent('storage', { key: boardOrderKey(3) }));
    });
    expect(ids(result.current.data)).toEqual([3, 2, 1]);
    act(() => {
      localStorage.removeItem(boardOrderKey(3));
      window.dispatchEvent(new StorageEvent('storage', { key: boardOrderKey(3) }));
    });
    expect(result.current.data).toBe(board);
  });
});
