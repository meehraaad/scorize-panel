import { describe, expect, it } from 'vitest';
import type { MyTask, TaskRequest } from '@/lib/tasks/api';
import { agendaOf, timelineOf, type AgendaSources } from './agenda';
import type { CallItem, HotLead, PendingReceipt, TodayConsultation } from './api';

const HOUR = 3_600_000;
const day = new Date();
day.setHours(0, 0, 0, 0);
const at = (hour: number) => day.getTime() + hour * HOUR;
const iso = (hour: number) => new Date(at(hour)).toISOString();
const NOW = at(11);

const lead = (id: number): HotLead => ({
  lead: id,
  customer: id,
  name: `lead ${String(id)}`,
  phone: '',
  score: 50,
  created_at: iso(10),
  reason: '',
  source: 'manual',
});
const call = (id: number, follow: string | null, bucket: CallItem['bucket']): CallItem => ({
  lead: id,
  customer: id,
  name: `call ${String(id)}`,
  phone: '',
  score: 50,
  reason: '',
  stage: 'contacted',
  bucket,
  follow_up_at: follow,
});
const consultation = (id: number, hour: number): TodayConsultation => ({
  id,
  customer: id,
  name: `consultation ${String(id)}`,
  type: 'apply',
  mode: 'online',
  starts_at: iso(hour),
  minutes: 45,
  logged: false,
  meeting_url: null,
});
const receipt = (payment: number): PendingReceipt => ({
  payment,
  customer: payment,
  name: '',
  amount: 1,
  what: '',
  method: 'card',
  uploaded_at: iso(9),
  receipt_url: '',
});
const task = (id: number, due: string): MyTask => ({
  id,
  text: '',
  due_at: due,
  person: null,
  source: 'me',
  snoozed: 0,
  step: null,
  action: 'open',
  note: '',
  suggested_next: '',
});
const request = (id: number, due: string, status: TaskRequest['status']): TaskRequest => ({
  id,
  from: { name: '', role: '' },
  created_at: iso(8),
  text: '',
  person: null,
  due_at: due,
  status,
  comments: 0,
  reactions: [],
});

const empty: AgendaSources = {
  hot: [],
  overdue: [],
  timedCalls: [],
  consultations: [],
  receipts: [],
  tasks: [],
  requests: [],
};

describe('agendaOf', () => {
  it('puts what is due on top in order, and the rest of today by its hour', () => {
    const { now, timed } = agendaOf(
      {
        hot: [lead(1)],
        overdue: [call(2, iso(-20), 'overdue')],
        timedCalls: [call(3, iso(9), 'today'), call(4, iso(15), 'today')],
        consultations: [consultation(5, 16), consultation(6, 10)],
        receipts: [receipt(7)],
        tasks: [task(8, iso(8)), task(9, iso(14)), task(10, iso(30))],
        requests: [
          request(11, iso(12), 'sent'),
          request(12, iso(13), 'done'),
          request(13, iso(10.5), 'seen'),
        ],
      },
      NOW,
    );
    expect(now.map((item) => item.key)).toEqual([
      'lead-1',
      'call-2',
      // Due earlier today: late, so it moves up.
      'call-3',
      'receipt-7',
      'task-8',
      'request-13',
    ]);
    // Consultations keep their hour even once past; tomorrow's task and a done request are left out.
    expect(timed.map((item) => item.key)).toEqual([
      'consultation-6',
      'request-11',
      'task-9',
      'call-4',
      'consultation-5',
    ]);
  });

  it('lists a lead once when it is both overdue and on the calendar', () => {
    const overdue = call(2, iso(-20), 'overdue');
    const { now, timed } = agendaOf(
      { ...empty, overdue: [overdue], timedCalls: [{ ...overdue, follow_up_at: iso(15) }] },
      NOW,
    );
    expect(now).toHaveLength(1);
    expect(timed).toHaveLength(0);
  });
});

describe('timelineOf', () => {
  it('draws the now line before what is ahead and hints at long free time', () => {
    const { timed } = agendaOf(
      {
        ...empty,
        consultations: [consultation(1, 10)],
        timedCalls: [call(2, iso(11.5), 'today'), call(3, iso(15), 'today')],
      },
      NOW,
    );
    expect(timelineOf(timed, NOW).map((row) => row.kind)).toEqual([
      'item',
      'now',
      'item',
      'free',
      'item',
    ]);
  });

  it('ends with the now line when everything is behind', () => {
    const { timed } = agendaOf({ ...empty, consultations: [consultation(1, 9)] }, NOW);
    expect(timelineOf(timed, NOW).map((row) => row.kind)).toEqual(['item', 'now']);
  });
});
