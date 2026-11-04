import { describe, expect, it } from 'vitest';
import { callDuration, callSeconds, type ObservedCall } from './phoneCalls';

const call: ObservedCall = {
  id: 'a'.repeat(40),
  extension: '103',
  phone: '09120000000',
  direction: 'inbound',
  status: 'connected',
  started_at: '2026-11-05T08:59:50Z',
  answered_at: '2026-11-05T09:00:00Z',
  ended_at: null,
  customer: null,
  clockOffsetMs: 60_000,
  connected: true,
};

describe('PBX call timer', () => {
  it('uses the answer time and server clock offset rather than counting ticks', () => {
    expect(callSeconds(call, Date.parse('2026-11-05T09:00:30Z'))).toBe(90);
    expect(callSeconds(call, Date.parse('2026-11-05T09:02:30Z'))).toBe(210);
  });
  it('freezes at the actual end time and never shows negative or invalid durations', () => {
    expect(callSeconds({ ...call, ended_at: '2026-11-05T09:03:20Z' }, Date.now())).toBe(200);
    expect(callSeconds(call, Date.parse('2026-11-05T08:00:00Z'))).toBe(0);
    expect(callSeconds({ ...call, answered_at: 'invalid' }, Date.now())).toBe(0);
    expect(callDuration(200)).toBe('03:20');
  });
});
