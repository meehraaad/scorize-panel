import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { Suspense, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router';
import { Composer } from '@/components/tickets/Composer';
import { MessageBubble, MessageThread } from '@/components/tickets/MessageThread';
import { buttonClass } from '@/components/ui/buttonStyles';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import { PageColumns, PageFill } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pager } from '@/components/ui/Pager';
import { SectionCard } from '@/components/ui/SectionCard';
import { SheetButton } from '@/components/ui/Sheet';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { ApiError } from '@/lib/api/client';
import { pagesOf } from '@/lib/api/page';
import { useFormat } from '@/lib/i18n/useFormat';
import { idParam } from '@/lib/router/lazyPage';
import { toast } from '@/lib/toast';
import {
  assistantsQuery,
  conversationQuery,
  conversationsQuery,
  isWaiting,
  useAsk,
  useFeedback,
  useStartConversation,
  type AssistantMessage,
} from './api';
import { AnswerTableView } from './components/AnswerTableView';
import { AnswerText } from './components/AnswerText';
import { conversationPath, FOUNDERS_ROOT } from './paths';

const TITLE_ID = 'assistant-chat-title';
const COMPOSER_ID = 'assistant-question';
const EXAMPLES = ['leads', 'sales', 'admissions', 'followUps'] as const;

/**
 * The founders' analysis assistant: ask about the business in Persian, get the answer in words and,
 * where a query listed people, a table only the founder sees. `/founders` starts a conversation;
 * `/founders/conversations/:id` continues one. Answers are written in the background, so an open
 * conversation is read again until they are ready.
 */
export default function AssistantPage() {
  const { t } = useTranslation('assistant');
  const id = idParam(useParams().id);

  const history = <ConversationList current={id} />;
  return (
    <PageFill>
      <PageHeader
        compact
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          <div className="flex items-center gap-2">
            {id !== null && (
              <Link to={FOUNDERS_ROOT} className={buttonClass('outline')}>
                <Icon name="plus" size={18} />
                <span className="max-lg:sr-only">{t('new')}</span>
              </Link>
            )}
            <SheetButton
              icon="list"
              label={t('history.open')}
              title={t('history.title')}
              closeLabel={t('close')}
              className="lg:hidden"
            >
              {history}
            </SheetButton>
          </div>
        }
      />
      <PageColumns
        fill
        asideLabel={t('history.title')}
        main={<ChatCard key={id ?? 'new'} id={id} />}
        aside={
          <SectionCard variant="panel" id="assistant-history" title={t('history.title')}>
            {history}
          </SectionCard>
        }
      />
    </PageFill>
  );
}

/** The conversation window: messages scroll, the question box stays at the bottom. */
function ChatCard({ id }: { id: number | null }) {
  const { t } = useTranslation('assistant');
  return (
    <Card
      aria-labelledby={TITLE_ID}
      className="flex flex-col max-lg:min-h-0 max-lg:flex-1 lg:h-[calc(100dvh-var(--panel-top)-190px)] lg:min-h-[560px]"
    >
      <h2 id={TITLE_ID} className="sr-only">
        {t('chat')}
      </h2>
      <Suspense
        fallback={
          <div aria-busy="true" className="min-h-0 flex-1 py-3">
            <SkeletonRows rows={3} />
          </div>
        }
      >
        {id === null ? <NewConversation /> : <OpenConversation id={id} />}
      </Suspense>
    </Card>
  );
}

/** No conversation yet: what the assistant can do, examples to start from, and the question box. */
function NewConversation() {
  const { t } = useTranslation('assistant');
  const navigate = useNavigate();
  const { data: assistants } = useSuspenseQuery(assistantsQuery());
  const start = useStartConversation();
  const [text, setText] = useState('');
  const assistant = assistants[0];

  if (!assistant)
    return (
      <div className="min-h-0 flex-1">
        <EmptyState variant="padded" title={t('none.title')} icon="lock">
          {t('none.text')}
        </EmptyState>
      </div>
    );

  const send = () =>
    start.mutate(
      { assistant: assistant.slug, text: text.trim() },
      {
        onSuccess: (conversation) =>
          void navigate(conversationPath(conversation.id), { replace: true }),
        onError: (error) => toast.error(t(askError(error))),
      },
    );

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-5 overflow-y-auto px-5 py-6 text-center lg:px-10">
        <span
          aria-hidden="true"
          className="flex size-14 items-center justify-center rounded-2xl bg-tint text-primary-text"
        >
          <Icon name="chart" size={26} />
        </span>
        <div className="flex max-w-[520px] flex-col gap-2">
          <p className="m-0 font-display text-xl font-bold">{t('welcome.title')}</p>
          <p className="m-0 text-[15px] leading-7 text-text-2">{t('welcome.text')}</p>
        </div>
        <ul
          aria-label={t('welcome.examples')}
          className="m-0 flex max-w-[640px] list-none flex-wrap justify-center gap-2 p-0"
        >
          {EXAMPLES.map((example) => (
            <li key={example}>
              <button
                type="button"
                onClick={() => {
                  setText(t(`examples.${example}`));
                  document.getElementById(`${COMPOSER_ID}-text`)?.focus();
                }}
                className="min-h-11 rounded-full bg-canvas px-4 py-2 text-[13px] leading-6 text-text shadow-[inset_0_0_0_1px_var(--line-2)] hover:shadow-[inset_0_0_0_1px_var(--line-3)]"
              >
                {t(`examples.${example}`)}
              </button>
            </li>
          ))}
        </ul>
      </div>
      <Composer
        id={COMPOSER_ID}
        label={t('question')}
        placeholder={t('placeholder')}
        value={text}
        onChange={setText}
        sendLabel={t('send')}
        sending={start.isPending}
        canSend={text.trim().length > 0}
        onSubmit={send}
      />
    </>
  );
}

/** An open conversation: the questions and answers, and the box for the next question. */
function OpenConversation({ id }: { id: number }) {
  const { t } = useTranslation('assistant');
  const { data: conversation } = useSuspenseQuery(conversationQuery(id));
  const ask = useAsk(id);
  const [text, setText] = useState('');
  const waiting = conversation.messages.some(isWaiting);

  const send = () =>
    ask.mutate(text.trim(), {
      onSuccess: () => setText(''),
      onError: (error) => toast.error(t(askError(error))),
    });

  return (
    <>
      <MessageThread
        label={t('messages')}
        firstKey={conversation.messages[0]?.id}
        lastKey={`${String(conversation.messages.at(-1)?.id)}-${String(conversation.messages.at(-1)?.status)}`}
        className="px-3.5 py-[18px] lg:px-7 lg:py-6"
      >
        {conversation.messages.map((message) => (
          <Message key={message.id} conversation={id} message={message} />
        ))}
      </MessageThread>
      <Composer
        id={COMPOSER_ID}
        label={t('question')}
        placeholder={waiting ? t('waitPlaceholder') : t('placeholderMore')}
        value={text}
        onChange={setText}
        sendLabel={t('send')}
        sending={ask.isPending}
        canSend={text.trim().length > 0 && !waiting}
        onSubmit={send}
      />
    </>
  );
}

/** A question, or an answer: being prepared, failed, or done with its tables and feedback. */
function Message({ conversation, message }: { conversation: number; message: AssistantMessage }) {
  const { t } = useTranslation('assistant');
  const f = useFormat();
  const common = { time: f.time(message.created_at), dateTime: message.created_at };

  if (message.role === 'user')
    return (
      <MessageBubble
        side="mine"
        author={t('you')}
        avatarName={t('you')}
        text={message.text}
        {...common}
      />
    );

  if (isWaiting(message))
    return (
      <MessageBubble
        side="other"
        author={t('assistant')}
        avatarName={t('assistant')}
        text=""
        body={
          <span role="status" className="flex items-center gap-2.5 text-text-2">
            <span aria-hidden="true" className="flex gap-1">
              {[0, 1, 2].map((dot) => (
                <span
                  key={dot}
                  className="size-1.5 animate-pulse rounded-full bg-current"
                  style={{ animationDelay: `${String(dot * 200)}ms` }}
                />
              ))}
            </span>
            {t('thinking')}
          </span>
        }
        {...common}
      />
    );

  if (message.status === 'failed')
    return (
      <MessageBubble
        side="other"
        author={t('assistant')}
        avatarName={t('assistant')}
        tag={{ label: t('failed'), tone: 'danger' }}
        outlined
        text={message.error || t('failedText')}
        {...common}
      />
    );

  const tables = message.data.tables ?? [];
  return (
    <MessageBubble
      side="other"
      author={t('assistant')}
      avatarName={t('assistant')}
      text={message.text}
      body={<AnswerText text={message.text} />}
      footer={
        <div className="flex w-full flex-col gap-2.5">
          {tables.map((table, index) => (
            <AnswerTableView key={index} table={table} />
          ))}
          <Feedback conversation={conversation} message={message} />
        </div>
      }
      {...common}
    />
  );
}

/** "Was this right?": two buttons; the chosen one stays pressed. */
function Feedback({ conversation, message }: { conversation: number; message: AssistantMessage }) {
  const { t } = useTranslation('assistant');
  const feedback = useFeedback(conversation);
  const choose = (value: 'right' | 'wrong') =>
    feedback.mutate(
      { message: message.id, feedback: value },
      {
        onSuccess: () => toast.success(t(value === 'right' ? 'feedback.thanks' : 'feedback.noted')),
        onError: () => toast.error(t('feedback.error')),
      },
    );
  const button = (value: 'right' | 'wrong') => {
    const pressed = message.feedback === value;
    return (
      <button
        type="button"
        aria-pressed={pressed}
        disabled={feedback.isPending}
        onClick={() => choose(value)}
        className={`inline-flex min-h-11 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium disabled:opacity-50 ${
          pressed
            ? value === 'right'
              ? 'bg-good-tint text-good'
              : 'bg-danger-tint text-danger'
            : 'text-text-2 shadow-[inset_0_0_0_1px_var(--line-2)] hover:text-text'
        }`}
      >
        <Icon name={value === 'right' ? 'check' : 'close'} size={16} />
        {t(`feedback.${value}`)}
      </button>
    );
  };
  return (
    <div
      role="group"
      aria-label={t('feedback.label')}
      className="flex flex-wrap items-center gap-2"
    >
      <span className="text-xs text-text-2">{t('feedback.label')}</span>
      {button('right')}
      {button('wrong')}
    </div>
  );
}

/** Earlier conversations, newest first, a page at a time. */
function ConversationList({ current }: { current: number | null }) {
  const { t } = useTranslation('assistant');
  const f = useFormat();
  const [page, setPage] = useState(1);
  const { data, isPending, isError, isPlaceholderData } = useQuery(conversationsQuery(page));

  if (isPending) return <SkeletonRows rows={3} />;
  if (isError) return <p className="m-0 text-sm text-text-2">{t('history.error')}</p>;
  if (data.results.length === 0)
    return <p className="m-0 text-sm leading-7 text-text-2">{t('history.empty')}</p>;

  return (
    <div className="flex flex-col gap-3">
      <ul className="m-0 flex list-none flex-col gap-1 p-0">
        {data.results.map((conversation) => {
          const active = conversation.id === current;
          return (
            <li key={conversation.id}>
              <Link
                to={conversationPath(conversation.id)}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-11 flex-col gap-0.5 rounded-xl px-3 py-2 ${
                  active ? 'bg-tint' : 'hover:bg-canvas'
                }`}
              >
                <span className="truncate text-sm font-medium">
                  {conversation.title || t('history.untitled')}
                </span>
                <span className="text-xs text-text-2">{f.date(conversation.updated_at)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      {pagesOf(data) > 1 && (
        <Pager
          inset
          page={page}
          pages={pagesOf(data)}
          onPage={setPage}
          pending={isPlaceholderData}
        />
      )}
    </div>
  );
}

/** What went wrong with a question, for the toast: still answering, too many questions, or else. */
function askError(error: unknown) {
  if (error instanceof ApiError && error.status === 409) return 'errors.busy' as const;
  if (error instanceof ApiError && error.status === 429) return 'errors.tooMany' as const;
  return 'errors.failed' as const;
}
