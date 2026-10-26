import {
  infiniteQueryOptions,
  queryOptions,
  useMutation,
  useQueryClient,
  type QueryKey,
} from '@tanstack/react-query';
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

function useRefresh(endpoint: TicketsEndpoint) {
  const client = useQueryClient();
  return () =>
    Promise.all(
      [endpoint.queryKey, ...(endpoint.invalidateKeys ?? [])].map((queryKey) =>
        client.invalidateQueries({ queryKey }),
      ),
    );
}

export interface NewMessage {
  text: string;
  priority: Priority;
  attachment: File | null;
}

export function useSendMessage(endpoint: TicketsEndpoint, thread: string) {
  const refresh = useRefresh(endpoint);
  return useMutation({
    mutationFn: ({ text, priority, attachment }: NewMessage) => {
      const body = new FormData();
      body.append('message', text);
      body.append('priority', String(priority));
      if (attachment) body.append('attachment', attachment);
      return api<TicketMessage>(`${endpoint.api}/${thread}/messages/`, { method: 'POST', body });
    },
    onSuccess: refresh,
  });
}

export function useRateMessage(endpoint: TicketsEndpoint, thread: string) {
  const refresh = useRefresh(endpoint);
  return useMutation({
    mutationFn: ({ id, score }: { id: number; score: number }) =>
      api(`${endpoint.api}/${thread}/messages/${String(id)}/rating/`, {
        method: 'POST',
        body: { score },
      }),
    onSuccess: refresh,
  });
}

/** The viewer opened the thread: the other side's messages count as seen. */
export function useMarkSeen(endpoint: TicketsEndpoint, thread: string) {
  const refresh = useRefresh(endpoint);
  return useMutation({
    mutationFn: () => api(`${endpoint.api}/${thread}/seen/`, { method: 'POST' }),
    onSuccess: refresh,
  });
}
