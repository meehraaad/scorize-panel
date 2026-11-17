import { describe, expect, it } from 'vitest';
import { followAtOf, followOnOf, isDayOnly } from './followUp';

describe('a follow-up picked on the calendar', () => {
  it('is a time, or a day with no hour', () => {
    expect(isDayOnly('2026-11-20')).toBe(true);
    expect(isDayOnly('2026-11-20T10:30')).toBe(false);
    expect(followOnOf('other', '2026-11-20')).toBe('2026-11-20');
    expect(followAtOf('other', '2026-11-20')).toBeNull();
    expect(followAtOf('other', '2026-11-20T10:30')).toBe(
      new Date('2026-11-20T10:30').toISOString(),
    );
    expect(followOnOf('other', '2026-11-20T10:30')).toBeNull();
    expect(followOnOf('tomorrow', '2026-11-20')).toBeNull();
  });
});
