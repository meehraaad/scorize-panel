import { listRowsOf, type ListRow } from '@/lib/schedule';
import type { MyTask, TaskRequest } from '@/lib/tasks/api';
import type { CallItem, HotLead, PendingReceipt, SellerCalendar, TodayConsultation } from './api';

const MINUTE = 60_000;
/** Consultation types without a length, and calls and tasks, take this long on the day. */
export const DEFAULT_MINUTES = 30;
const SHORT_MINUTES = 15;
/** Free time at least this long, still ahead, gets a hint between two items of the day. */
export const FREE_MINUTES = 90;

/** What a row of the day is. */
export type AgendaItem =
  | { kind: 'lead'; key: string; at: null; lead: HotLead }
  | { kind: 'call'; key: string; at: number | null; call: CallItem }
  | { kind: 'consultation'; key: string; at: number; end: number; consultation: TodayConsultation }
  | { kind: 'task'; key: string; at: number; task: MyTask }
  | { kind: 'request'; key: string; at: number; request: TaskRequest }
  | { kind: 'receipt'; key: string; at: null; receipt: PendingReceipt };

export type AgendaKind = AgendaItem['kind'];

/** The day's filter buttons. */
export const AGENDA_FILTERS = ['all', 'calls', 'consultations', 'tasks', 'receipts'] as const;
export type AgendaFilter = (typeof AGENDA_FILTERS)[number];

const FILTER_OF: Record<AgendaKind, Exclude<AgendaFilter, 'all'>> = {
  lead: 'calls',
  call: 'calls',
  consultation: 'consultations',
  task: 'tasks',
  request: 'tasks',
  receipt: 'receipts',
};

export const filterOf = (item: AgendaItem) => FILTER_OF[item.kind];

/** Requests still waiting for me (not done or refused). */
const OPEN_REQUEST = new Set<TaskRequest['status']>(['sent', 'seen', 'in_progress']);

export interface AgendaSources {
  hot: HotLead[];
  /** Follow-ups due before today. */
  overdue: CallItem[];
  /** Today's follow-ups with a time. */
  timedCalls: CallItem[];
  consultations: TodayConsultation[];
  receipts: PendingReceipt[];
  tasks: MyTask[];
  requests: TaskRequest[];
}

export interface Agenda {
  /** Due now, in order: new leads, late follow-ups, receipts, late tasks. No hour of their own. */
  now: AgendaItem[];
  /** The rest of today by time; consultations stay at their hour even once past. */
  timed: AgendaItem[];
}

/**
 * Today's one timetable (canvas "داشبورد امروز"): new leads, follow-ups, consultations, my tasks,
 * colleagues' requests and receipts. What is already due goes to the top ("now"); what has an hour
 * later today sits at that hour.
 */
export function agendaOf(sources: AgendaSources, now: number): Agenda {
  const endOfDay = new Date(now);
  endOfDay.setHours(24, 0, 0, 0);
  const due: AgendaItem[] = sources.hot.map((lead) => ({
    kind: 'lead',
    key: `lead-${String(lead.lead)}`,
    at: null,
    lead,
  }));
  const lateTasks: AgendaItem[] = [];
  const timed: AgendaItem[] = [];

  const seen = new Set<number>();
  for (const call of sources.overdue) {
    seen.add(call.lead);
    due.push({ kind: 'call', key: `call-${String(call.lead)}`, at: null, call });
  }
  for (const call of sources.timedCalls) {
    if (seen.has(call.lead) || !call.follow_up_at) continue;
    seen.add(call.lead);
    const at = new Date(call.follow_up_at).getTime();
    const item: AgendaItem = { kind: 'call', key: `call-${String(call.lead)}`, at, call };
    (at <= now ? due : timed).push(item);
  }
  for (const receipt of sources.receipts)
    due.push({ kind: 'receipt', key: `receipt-${String(receipt.payment)}`, at: null, receipt });

  for (const consultation of sources.consultations) {
    const at = new Date(consultation.starts_at).getTime();
    timed.push({
      kind: 'consultation',
      key: `consultation-${String(consultation.id)}`,
      at,
      end: at + (consultation.minutes ?? DEFAULT_MINUTES) * MINUTE,
      consultation,
    });
  }
  // A follow-up task is the same thing as its customer's call row (the lead's time is the task's): shown once.
  const called = new Set<number>();
  for (const item of due) if (item.kind === 'call') called.add(item.call.customer);
  for (const item of timed) if (item.kind === 'call') called.add(item.call.customer);
  // A receipt's review task is the receipt row.
  const receipts = new Set(sources.receipts.map((receipt) => receipt.payment));
  for (const task of sources.tasks) {
    if (task.follow_up && task.person && called.has(task.person.id)) continue;
    if (task.receipt !== null && receipts.has(task.receipt)) continue;
    const at = new Date(task.due_at).getTime();
    if (at >= endOfDay.getTime()) continue;
    const item: AgendaItem = { kind: 'task', key: `task-${String(task.id)}`, at, task };
    (at <= now ? lateTasks : timed).push(item);
  }
  for (const request of sources.requests) {
    if (!OPEN_REQUEST.has(request.status)) continue;
    const at = new Date(request.due_at).getTime();
    if (at >= endOfDay.getTime()) continue;
    const item: AgendaItem = { kind: 'request', key: `request-${String(request.id)}`, at, request };
    (at <= now ? lateTasks : timed).push(item);
  }

  lateTasks.sort((a, b) => (a.at ?? 0) - (b.at ?? 0));
  timed.sort((a, b) => (a.at ?? 0) - (b.at ?? 0) || a.key.localeCompare(b.key));
  return { now: [...due, ...lateTasks], timed };
}

/** When an item of the day is over (for the free time after it). */
export const endOf = (item: AgendaItem) =>
  item.kind === 'consultation' ? item.end : (item.at ?? 0) + SHORT_MINUTES * MINUTE;

/** A row of the timetable: an item, the line at the current time, or free time ahead. */
export type TimelineRow = ListRow<AgendaItem>;

/** The timed items with the "now" line among them and hints for long free stretches ahead. */
export const timelineOf = (items: AgendaItem[], now: number): TimelineRow[] =>
  listRowsOf(items, now, { at: (item) => item.at ?? 0, end: endOf, freeMinutes: FREE_MINUTES });

/**
 * Another day's plan, from the seller's calendar for that day: its consultations and timed
 * follow-ups by the hour. Nothing is "due now" on another day; its tasks are only counted.
 */
export function dayAgendaOf(day: SellerCalendar): Agenda {
  const typeName = new Map(day.types.map((type) => [type.id, type.name]));
  const timed: AgendaItem[] = day.calls.map((call) => ({
    kind: 'call',
    key: `call-${String(call.lead)}`,
    at: new Date(call.follow_up_at).getTime(),
    // The calendar sends no stage or score; a timed row shows neither.
    call: { ...call, score: 0, stage: 'new', bucket: 'today' },
  }));
  for (const consultation of day.consultations) {
    const at = new Date(consultation.starts_at).getTime();
    timed.push({
      kind: 'consultation',
      key: `consultation-${String(consultation.id)}`,
      at,
      end: at + (consultation.minutes ?? DEFAULT_MINUTES) * MINUTE,
      consultation: {
        ...consultation,
        type: typeName.get(consultation.type) ?? '',
        meeting_url: null,
        // Someone else's on a manager's day: whose ('' nobody's).
        seller: consultation.mine ? null : (consultation.seller ?? ''),
      },
    });
  }
  timed.sort((a, b) => (a.at ?? 0) - (b.at ?? 0) || a.key.localeCompare(b.key));
  return { now: [], timed };
}
