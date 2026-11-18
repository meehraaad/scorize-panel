import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import {
  ASSISTANT_KEY,
  AI_API,
  type AssistantMessage,
  type ConversationRow,
  type Conversation,
  conversationQuery,
} from './api';

/**
 * The mutations of `./api`, apart from its queries: the routes' page data imports those, so
 * this code stays out of the first load and comes with the pages that change something.
 */
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
