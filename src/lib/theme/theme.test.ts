import { beforeEach, describe, expect, it } from 'vitest';
import { applyTheme, readStoredMode, resolveTheme, storeMode } from './theme';

describe('theme', () => {
  beforeEach(() => localStorage.clear());

  it('defaults to following the device', () => {
    expect(readStoredMode()).toBe('system');
  });

  it('remembers an explicit choice', () => {
    storeMode('dark');
    expect(readStoredMode()).toBe('dark');
    expect(resolveTheme('dark')).toBe('dark');
  });

  it('ignores garbage in storage', () => {
    localStorage.setItem('scorize.theme', 'purple');
    expect(readStoredMode()).toBe('system');
  });

  it('writes the resolved theme to <html>', () => {
    applyTheme('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });
});
