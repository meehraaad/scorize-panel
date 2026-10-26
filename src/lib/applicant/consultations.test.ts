import { describe, expect, it } from 'vitest';
import { recentSession, type Consultation } from './consultations';

const NOW = Date.parse('2026-10-26T12:00:00Z');
const session = (minutesAgo: number, id = 1) =>
  ({
    id,
    starts_at: new Date(NOW - minutesAgo * 60_000).toISOString(),
    minutes: 45,
  }) as Consultation;

describe('recentSession', () => {
  it('asks once the last session has ended, for a month', () => {
    expect(recentSession([session(45)], NOW)?.id).toBe(1);
    expect(recentSession([session(60 * 24 * 29)], NOW)?.id).toBe(1);
    expect(recentSession([session(60 * 24 * 31)], NOW)).toBeUndefined();
  });

  it('waits while the session is still going', () => {
    expect(recentSession([session(20, 2), session(60 * 24, 1)], NOW)).toBeUndefined();
  });

  it('waits when another session is booked', () => {
    expect(recentSession([session(60), session(-60 * 24, 2)], NOW)).toBeUndefined();
  });
});
