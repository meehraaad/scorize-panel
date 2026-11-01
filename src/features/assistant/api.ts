import { keepPreviousData, queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { Page } from '@/lib/api/page';

/**
 * The AI hub's API (scorize-revolution `api/ai/v1/`, docs/backend-changes.md AI1–AI5): the
 * assistants the user may use, their conversations, asking and feedback. A question is answered in
 * the background: the answer comes back `pending`, and the conversation is read again until it is
 * `done` or `failed`. Mock: src/mocks/assistant.ts.
 */

export const ASSISTANT_KEY = ['assistant'] as const;
const AI_API = '/ai/v1';

/** How often an open conversation is read again while an answer is being prepared. */
export const POLL_MS = 2_000;

export interface Assistant {
  slug: string;
  name: string;
  description: string;
}

/** A table a tool showed the user only (protected columns included); the model never saw it. */
export interface AnswerTable {
  tool: string;
  title: string;
  columns: { key: string; label: string }[];
  rows: Record<string, string | number | boolean | null>[];
  /** More rows matched than were sent. */
  truncated?: boolean;
}

export type MessageStatus = 'pending' | 'running' | 'done' | 'failed';

export interface AssistantMessage {
  id: number;
  role: 'user' | 'assistant';
  text: string;
  data: { tables?: AnswerTable[] };
  status: MessageStatus;
  /** Why an answer failed, ready to show. */
  error: string;
  feedback: '' | 'right' | 'wrong';
  created_at: string;
}

export interface ConversationRow {
  id: number;
  assistant: string;
  title: string;
  /** Pinned to the top of the list (AI7; missing before it shipped). */
  pinned?: boolean;
  created_at: string;
  updated_at: string;
}

export interface Conversation extends ConversationRow {
  messages: AssistantMessage[];
}

export const isWaiting = (message: Pick<AssistantMessage, 'status'>) =>
  message.status === 'pending' || message.status === 'running';

export const assistantsQuery = () =>
  queryOptions({
    queryKey: [...ASSISTANT_KEY, 'assistants'],
    queryFn: ({ signal }) => api<Assistant[]>(`${AI_API}/assistants/`, { signal }),
  });

export const conversationsQuery = (page: number) =>
  queryOptions({
    queryKey: [...ASSISTANT_KEY, 'conversations', page],
    queryFn: ({ signal }) =>
      api<Page<ConversationRow>>(`${AI_API}/conversations/?page=${String(page)}`, { signal }),
    placeholderData: keepPreviousData,
  });

export const conversationQuery = (id: number) =>
  queryOptions({
    queryKey: [...ASSISTANT_KEY, 'conversation', id],
    queryFn: ({ signal }) =>
      api<Conversation>(`${AI_API}/conversations/${String(id)}/`, { signal }),
    // Read again until the answer is ready (it is written in the background).
    refetchInterval: (query) => (query.state.data?.messages.some(isWaiting) ? POLL_MS : false),
  });

/** A new conversation with its first question; answers the conversation (its answer pending). */
export function useStartConversation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: { assistant: string; text: string }) =>
      api<Conversation>(`${AI_API}/conversations/`, { method: 'POST', body }),
    onSuccess: (conversation) => {
      client.setQueryData(conversationQuery(conversation.id).queryKey, conversation);
      void client.invalidateQueries({ queryKey: [...ASSISTANT_KEY, 'conversations'] });
    },
  });
}

/** Another question in the conversation; the conversation is read again to show both messages. */
export function useAsk(conversation: number) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (text: string) =>
      api<AssistantMessage>(`${AI_API}/conversations/${String(conversation)}/messages/`, {
        method: 'POST',
        body: { text },
      }),
    onSuccess: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: conversationQuery(conversation).queryKey }),
        client.invalidateQueries({ queryKey: [...ASSISTANT_KEY, 'conversations'] }),
      ]),
  });
}

/** Right or wrong, on an answer: the wrong ones are reviewed each week. */
export function useFeedback(conversation: number) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ message, feedback }: { message: number; feedback: 'right' | 'wrong' }) =>
      api<AssistantMessage>(`${AI_API}/messages/${String(message)}/feedback/`, {
        method: 'POST',
        body: { feedback },
      }),
    onSuccess: (answer) =>
      client.setQueryData(conversationQuery(conversation).queryKey, (data) =>
        data
          ? {
              ...data,
              messages: data.messages.map((item) => (item.id === answer.id ? answer : item)),
            }
          : data,
      ),
  });
}

/**
 * Rename a conversation or pin it to the top of the list (AI7 `PATCH conversations/<id>/`). Neither
 * moves it among the others, so the pages are only read again.
 */
export function useChangeConversation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: number; title?: string; pinned?: boolean }) =>
      api<ConversationRow>(`${AI_API}/conversations/${String(id)}/`, { method: 'PATCH', body }),
    onSuccess: (row) => {
      client.setQueryData(conversationQuery(row.id).queryKey, (data) =>
        data ? { ...data, ...row } : data,
      );
      return client.invalidateQueries({ queryKey: [...ASSISTANT_KEY, 'conversations'] });
    },
  });
}
