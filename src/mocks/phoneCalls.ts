import { http, HttpResponse } from 'msw';
import type { PhoneSnapshot } from '@/lib/sales/phoneCalls';
import { forbidden, storage } from './session';

let snapshots = new Map<number, PhoneSnapshot>();

export function setPhoneSnapshot(owner: number, snapshot: PhoneSnapshot) {
  snapshots.set(owner, snapshot);
}

export function resetPhoneMocks() {
  snapshots = new Map();
}

export const phoneCallHandlers = [
  http.get('/api/sales/v1/calls/', () => {
    const owner = storage.get();
    if (owner !== 3 && owner !== 4) return forbidden();
    return HttpResponse.json(
      snapshots.get(owner) ?? {
        available: false,
        enabled: false,
        connected: false,
        extension: null,
        server_time: new Date().toISOString(),
        calls: [],
      },
    );
  }),
  http.get('/api/sales/v1/calls/mobile/', () => {
    const owner = storage.get();
    if (owner !== 3 && owner !== 4) return forbidden();
    return HttpResponse.json({
      available: false,
      status: 'none',
      extension: null,
      password: null,
      domain: null,
      server: null,
    });
  }),
];
