import { keepPreviousData, queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { TicketsEndpoint, WritingDepartment } from '@/lib/tickets/api';

/**
 * The writer panel: writing orders (SOP, CV, letters, …) assigned to the logged-in writer.
 * Shapes: docs/backend-changes.md WR1–WR6. Mock: src/mocks/writer.ts.
 */

export const WRITER_KEY = ['writer'] as const;
export const WRITER_API = '/writer/v1';

/**
 * Where an order is: `new` (the form is final, nothing written yet), `drafting` (a draft is being
 * written), `revision` (the applicant asked for changes), `waiting_applicant` (a draft is with the
 * applicant), `delivered` (the final file is in the case's documents).
 */
export type OrderState = 'new' | 'drafting' | 'revision' | 'waiting_applicant' | 'delivered';

/** The queue's tabs: orders waiting on the writer, on the applicant, and delivered ones. */
export const QUEUE_VIEWS = ['mine', 'applicant', 'delivered'] as const;
export type QueueView = (typeof QUEUE_VIEWS)[number];

export interface OrderRow {
  id: number;
  file_number: number;
  applicant: string;
  type: WritingDepartment;
  /** "MSc Computer Science · University of Toronto"; null for orders without one target. */
  program: string | null;
  state: OrderState;
  /** Drafts sent so far. */
  drafts: number;
  /** Revision round the order is in, of the contract's rounds; null before the first. */
  round: { current: number; max: number } | null;
  /** Points in the applicant's latest revision request. */
  notes: number;
  /** When the next version is due; null once delivered. */
  due_at: string | null;
  delivered_at: string | null;
  /** The applicant's messages the writer hasn't read. */
  unread: number;
}

export interface QueueData {
  counts: Record<QueueView, number>;
  /** Soonest due first. */
  results: OrderRow[];
  /** Versions due in the next 7 days, soonest first. */
  week: {
    order: number;
    applicant: string;
    type: WritingDepartment;
    due_at: string;
    next: 'draft' | 'revision' | 'final';
    draft: number;
  }[];
  /** Open orders and the most the writer takes; the team lead assigns by it. */
  capacity: { open: number; max: number };
  /** The writing team's guides (title, link). */
  guides: { title: string; url: string }[];
}

export const queueQuery = (view: QueueView) =>
  queryOptions({
    queryKey: [...WRITER_KEY, 'orders', view],
    queryFn: ({ signal }) => api<QueueData>(`${WRITER_API}/orders/?view=${view}`, { signal }),
    placeholderData: keepPreviousData,
  });

export interface OrderVersion {
  id: number;
  /** 1, 2, …: the draft's number. */
  number: number;
  final: boolean;
  file: { name: string; url: string; words: number | null };
  sent_at: string;
  /** The writer's note to the applicant. */
  note: string | null;
  /** The applicant's revision request on this version. */
  revision: { requested_at: string; notes: string[] } | null;
}

export interface OrderData {
  id: number;
  file_number: number;
  applicant: { id: number; name: string };
  type: WritingDepartment;
  program: string | null;
  /** The program's length limit. */
  words: { min: number; max: number } | null;
  supervisor: string | null;
  ordered_at: string;
  state: OrderState;
  round: { current: number; max: number } | null;
  due_at: string | null;
  unread: number;
  /** The applicant's form as a PDF. */
  form_pdf: string | null;
  /** Oldest first. */
  versions: OrderVersion[];
  /** Whether a final delivery is allowed now (the applicant approved, or the rounds are used). */
  can_finalize: boolean;
  /** The applicant's information form, as the server words it (questions in the request's language). */
  form: {
    submitted_at: string | null;
    sections: { title: string; summary: string; answers: { question: string; answer: string }[] }[];
  };
  /** The target program's rules for this document, written by the supervisor. */
  requirements: string[];
  program_url: string | null;
  /** Files of the case the writer may read. */
  documents: { name: string; url: string }[];
  /** The latest messages of the order's conversation, oldest first. */
  messages: { id: number; author: string; mine: boolean; at: string; text: string }[];
}

export const orderKey = (id: number) => [...WRITER_KEY, 'order', id] as const;

export const orderQuery = (id: number) =>
  queryOptions({
    queryKey: orderKey(id),
    queryFn: ({ signal }) => api<OrderData>(`${WRITER_API}/orders/${String(id)}/`, { signal }),
  });

/** What a version upload accepts (Word or PDF). The server checks the content again. */
export const VERSION_FILE = {
  types: [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/pdf',
  ],
  maxBytes: 10 * 1024 * 1024,
} as const;

/** Sends a new version to the applicant, or the final file to the case's documents. */
export function useSendVersion(id: number) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ file, note, final }: { file: File; note: string; final: boolean }) => {
      const body = new FormData();
      body.append('file', file);
      body.append('note', note);
      body.append('final', String(final));
      return api<OrderVersion>(`${WRITER_API}/orders/${String(id)}/versions/`, {
        method: 'POST',
        body,
      });
    },
    onSuccess: () => client.invalidateQueries({ queryKey: WRITER_KEY }),
  });
}

/** One order's conversation with the applicant, for the shared tickets page (`viewer: 'staff'`). */
export const orderTickets = (id: number): TicketsEndpoint => ({
  api: `${WRITER_API}/orders/${String(id)}/tickets`,
  queryKey: orderKey(id),
});
