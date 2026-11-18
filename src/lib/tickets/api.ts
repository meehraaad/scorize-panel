import { infiniteQueryOptions, queryOptions, type QueryKey } from '@tanstack/react-query';
import { ApiError, api } from '@/lib/api/client';

/**
 * Tickets: one running conversation per department, as in Django. A `Ticket` row
 * (user_profile/common/models.py) is one message; `SupervisorTicket` hangs off the Applicant
 * (one thread per case), `SopResumeTicket` off a writing order + `ticket_type` (one thread per
 * writing department). Shapes: docs/backend-changes.md H17–H21.
 *
 * Panel-neutral: every call takes the panel's endpoint (`api`) and query-key prefix (`queryKey`),
 * so the supervisor and writer panels can reuse the same hooks and blocks later.
 */

export interface TicketsEndpoint {
  /** API path of the tickets root, e.g. '/applicant/v1/tickets'. */
  api: string;
  /**
   * Query-key prefix. Changes refresh everything under it (the applicant passes APPLICANT_KEY,
   * so the home page's ticket card updates too).
   */
  queryKey: QueryKey;
  /** Related dashboards whose unread/waiting counts change with this conversation. */
  invalidateKeys?: readonly QueryKey[];
}

/**
 * What a panel passes to the tickets page. The page itself is panel-neutral: the applicant panel
 * passes its endpoint today; the supervisor and writer panels can pass theirs (one applicant's
 * threads) later, with `viewer: 'staff'`.
 */
export interface TicketsConfig extends TicketsEndpoint {
  /** Router path of the page ('/tickets'). The first thread opens there, others at `<path>/<thread id>`. */
  path: string;
  /**
   * `applicant`: picks a priority (with the very-urgent rules) and rates staff replies.
   * `staff`: neither; sees the applicant's ratings.
   */
  viewer: 'applicant' | 'staff';
  /** Staff: the applicant's name, filled into a ready reply's `{customer}`. */
  customer?: string | undefined;
  /** Staff on a case's chat: the case (Applicant id), so a ready reply comes filled in for it. */
  caseId?: number | undefined;
}

/** Ticket.Priority. */
export const PRIORITIES = [0, 1, 2, 3] as const;
export type Priority = (typeof PRIORITIES)[number];
/** Django's default for a new message. */
export const DEFAULT_PRIORITY: Priority = 1;
/** «خیلی ضروری»: answered outside working hours too; the sender must accept the rules first. */
export const URGENT: Priority = 3;

export type StaffRole = 'supervisor' | 'consultant' | 'writer' | 'support';

/** SopResumeTicket.Type, by the names the panel uses for writing orders. */
export type WritingDepartment = 'sop' | 'cv' | 'recommendation' | 'ps' | 'ds' | 'pl';

export interface TicketMessage {
  id: number;
  /** Written by the person viewing. */
  mine: boolean;
  author: string;
  /** The author's role on the case; null for the applicant. */
  role: StaffRole | null;
  sent_at: string;
  text: string;
  priority: Priority;
  attachment: { name: string; url: string } | null;
  /** Ticket.is_seen: the other side has read it. */
  seen: boolean;
  /** 1–5 once the applicant rated a staff reply. */
  rating: number | null;
  /** Sent by SupervisorAutoResponse, not typed by a person (can't be rated). */
  auto: boolean;
}

export interface TicketThread {
  /** URL segment: 'supervisor' or 'writing/<department>'. */
  id: string;
  department: 'supervisor' | 'writing';
  /** The writing department, for writing threads. */
  writing: WritingDepartment | null;
  /** Messages from the other side not seen yet. */
  unread: number;
  /** Who answers in this thread (shown in its header). */
  team: { name: string; role: StaffRole }[];
}

export interface Faq {
  id: number;
  department: TicketThread['department'];
  question: string;
  answer: string;
}

export interface TicketsOverview {
  threads: TicketThread[];
  faqs: Faq[];
}

export interface MessagePage {
  /** Oldest first. */
  messages: TicketMessage[];
  has_more: boolean;
}

/** What a message may carry. The server checks again. */
export const ATTACHMENT_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const;
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

const threadKey = (endpoint: TicketsEndpoint, thread: string) => [
  ...endpoint.queryKey,
  'tickets',
  thread,
];

export const ticketsQuery = (endpoint: TicketsEndpoint) =>
  queryOptions({
    queryKey: [...endpoint.queryKey, 'tickets'],
    queryFn: async ({ signal }): Promise<TicketsOverview | null> => {
      try {
        return await api<TicketsOverview>(`${endpoint.api}/`, { signal });
      } catch (error) {
        // No case yet (no contract): nobody to write to.
        if (error instanceof ApiError && error.status === 404) return null;
        throw error;
      }
    },
    staleTime: 30_000,
  });

/** Newest page first; "show earlier messages" loads the page before the oldest one shown. */
export const messagesQuery = (endpoint: TicketsEndpoint, thread: string) =>
  infiniteQueryOptions({
    queryKey: [...threadKey(endpoint, thread), 'messages'],
    queryFn: ({ pageParam, signal }) =>
      api<MessagePage>(
        `${endpoint.api}/${thread}/messages/${pageParam === null ? '' : `?before=${String(pageParam)}`}`,
        { signal },
      ),
    initialPageParam: null as number | null,
    getNextPageParam: (page) => (page.has_more ? (page.messages[0]?.id ?? null) : null),
    staleTime: 30_000,
  });

/** Every loaded page, oldest message first. */
export const messagesOf = (pages: readonly MessagePage[]) =>
  pages.toReversed().flatMap((page) => page.messages);

export interface NewMessage {
  text: string;
  priority: Priority;
  attachment: File | null;
}
