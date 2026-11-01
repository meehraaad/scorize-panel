import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { Suspense, useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router';
import { Composer } from '@/components/tickets/Composer';
import { MessageBubble, MessageThread } from '@/components/tickets/MessageThread';
import { buttonClass } from '@/components/ui/buttonStyles';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { PageWorkspace } from '@/components/ui/PageColumns';
import { Pager } from '@/components/ui/Pager';
import { SheetButton } from '@/components/ui/Sheet';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { ApiError } from '@/lib/api/client';
import { pagesOf } from '@/lib/api/page';
import { ON_SERVER } from '@/lib/applicant/onServer';
import { useFormat } from '@/lib/i18n/useFormat';
import { idParam } from '@/lib/router/lazyPage';
import { toast } from '@/lib/toast';
import {
  assistantsQuery,
  conversationQuery,
  conversationsQuery,
  isWaiting,
  useAsk,
  useChangeConversation,
  useFeedback,
  useStartConversation,
  type AssistantMessage,
  type ConversationRow,
} from './api';
import { AnswerTableView } from './components/AnswerTableView';
import { AnswerText } from './components/AnswerText';
import { conversationPath, FOUNDERS_ROOT } from './paths';

const CHAT_ID = 'assistant-chat';
const COMPOSER_ID = 'assistant-question';
const EXAMPLES = ['leads', 'sales', 'admissions', 'followUps'] as const;
/** The reading column of the conversation and the question bar (an AI chat's width). */
const COLUMN = 'lg:px-[max(1.5rem,calc((100%-780px)/2))]';

/**
 * The founders' analysis assistant: ask about the business in Persian, get the answer in words and,
 * where a query listed people, a table only the founder sees. `/founders` starts a conversation;
 * `/founders/conversations/:id` continues one. Answers are written in the background, so an open
 * conversation is read again until they are ready.
 *
 * Laid out like an AI chat app: the whole screen (a workspace, full screen on request), the
 * conversations in a side column (a sheet on phones), the question bar at the bottom.
 */
export default function AssistantPage() {
  const { t } = useTranslation('assistant');
  const id = idParam(useParams().id);
  const [fullscreen, setFullscreen] = useState(false);

  const history = <ConversationList current={id} />;
  const fullscreenButton = (
    <IconButton
      icon={fullscreen ? 'collapse' : 'expand'}
      aria-label={fullscreen ? t('fullscreen.exit') : t('fullscreen.enter')}
      aria-pressed={fullscreen}
      tone="muted"
      onClick={() => setFullscreen((value) => !value)}
    />
  );
  const newLink = (
    <Link to={FOUNDERS_ROOT} className={buttonClass('outline', 'flex-1 justify-start')}>
      <Icon name="plus" size={18} />
      {t('new')}
    </Link>
  );

  return (
    <PageWorkspace fullscreen={fullscreen} onExitFullscreen={() => setFullscreen(false)}>
      <h1 className="sr-only">{t('title')}</h1>
      <div className="flex min-h-0 flex-1 border-t border-hair">
        <aside
          aria-label={t('history.title')}
          className="flex w-[288px] flex-none flex-col border-e border-hair bg-surface max-lg:hidden"
        >
          <div className="flex flex-none items-center gap-1.5 p-3">
            {newLink}
            {fullscreenButton}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-4">
            {history}
          </div>
        </aside>

        <section
          aria-labelledby={`${CHAT_ID}-title`}
          className="flex min-h-0 min-w-0 flex-1 flex-col bg-canvas"
        >
          <h2 id={`${CHAT_ID}-title`} className="sr-only">
            {t('chat')}
          </h2>
          <div className="flex flex-none items-center gap-2 px-3 pt-2 lg:hidden">
            <SheetButton
              icon="list"
              label={t('history.open')}
              title={t('history.title')}
              closeLabel={t('close')}
            >
              {history}
            </SheetButton>
            <span className="flex-1" />
            {id !== null && (
              <Link
                to={FOUNDERS_ROOT}
                aria-label={t('new')}
                className="inline-flex size-11 items-center justify-center rounded-full bg-surface text-text shadow-[inset_0_0_0_1px_var(--line-2)]"
              >
                <Icon name="plus" />
              </Link>
            )}
          </div>
          <Suspense
            fallback={
              <div aria-busy="true" className={`min-h-0 flex-1 py-6 ${COLUMN}`}>
                <SkeletonRows rows={3} />
              </div>
            }
          >
            {id === null ? <NewConversation key="new" /> : <OpenConversation key={id} id={id} />}
          </Suspense>
        </section>
      </div>
    </PageWorkspace>
  );
}

/** The question bar, the same for a new and an open conversation. */
function QuestionBar({
  value,
  onChange,
  placeholder,
  sending,
  canSend,
  onSubmit,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  sending: boolean;
  canSend: boolean;
  onSubmit: () => void;
}) {
  const { t } = useTranslation('assistant');
  return (
    <Composer
      variant="chat"
      id={COMPOSER_ID}
      label={t('question')}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      sendLabel={t('send')}
      hint={t('hint')}
      sending={sending}
      canSend={canSend}
      onSubmit={onSubmit}
    />
  );
}

/** No conversation yet: what the assistant can do, examples to start from, and the question bar. */
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
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 overflow-y-auto px-5 py-8 text-center">
        <AssistantMark large />
        <div className="flex max-w-[560px] flex-col gap-2">
          <p className="m-0 font-display text-2xl font-bold">{t('welcome.title')}</p>
          <p className="m-0 text-[15px] leading-7 text-text-2">{t('welcome.text')}</p>
        </div>
        <ul
          aria-label={t('welcome.examples')}
          className="m-0 grid w-full max-w-[680px] list-none gap-2 p-0 sm:grid-cols-2"
        >
          {EXAMPLES.map((example) => (
            <li key={example} className="flex">
              <button
                type="button"
                onClick={() => {
                  setText(t(`examples.${example}`));
                  document.getElementById(`${COMPOSER_ID}-text`)?.focus();
                }}
                className="flex min-h-14 w-full items-center rounded-2xl border border-hair bg-surface px-4 py-3 text-start text-sm leading-6 text-text hover:border-primary"
              >
                {t(`examples.${example}`)}
              </button>
            </li>
          ))}
        </ul>
      </div>
      <QuestionBar
        value={text}
        onChange={setText}
        placeholder={t('placeholder')}
        sending={start.isPending}
        canSend={text.trim().length > 0}
        onSubmit={send}
      />
    </>
  );
}

/** An open conversation: the questions and answers, and the bar for the next question. */
function OpenConversation({ id }: { id: number }) {
  const { t } = useTranslation('assistant');
  const { data: conversation } = useSuspenseQuery(conversationQuery(id));
  const ask = useAsk(id);
  const [text, setText] = useState('');
  const waiting = conversation.messages.some(isWaiting);

  const send = () => {
    const question = text.trim();
    // The bar empties at once, like a chat; the question comes back if it wasn't sent.
    setText('');
    ask.mutate(question, {
      onError: (error) => {
        setText((current) => current || question);
        toast.error(t(askError(error)));
      },
    });
  };

  return (
    <>
      <MessageThread
        label={t('messages')}
        firstKey={conversation.messages[0]?.id}
        lastKey={`${String(conversation.messages.at(-1)?.id)}-${String(conversation.messages.at(-1)?.status)}`}
        className={`px-4 py-6 ${COLUMN}`}
      >
        {conversation.messages.map((message) => (
          <Message key={message.id} conversation={id} message={message} />
        ))}
      </MessageThread>
      <QuestionBar
        value={text}
        onChange={setText}
        placeholder={waiting ? t('waitPlaceholder') : t('placeholderMore')}
        sending={ask.isPending}
        canSend={text.trim().length > 0 && !waiting}
        onSubmit={send}
      />
    </>
  );
}

/** The assistant's round mark (decorative). */
function AssistantMark({ large = false }: { large?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`flex flex-none items-center justify-center rounded-full bg-tint text-primary-text ${
        large ? 'size-16' : 'size-9'
      }`}
    >
      <Icon name="chart" size={large ? 28 : 18} />
    </span>
  );
}

/** A question, or an answer: being prepared, failed, or done with its tables and feedback. */
function Message({ conversation, message }: { conversation: number; message: AssistantMessage }) {
  const { t } = useTranslation('assistant');
  const f = useFormat();
  const common = {
    chat: true,
    time: f.time(message.created_at),
    dateTime: message.created_at,
  };
  const assistant = {
    side: 'other' as const,
    author: t('assistant'),
    avatarName: t('assistant'),
    avatar: <AssistantMark />,
  };

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
        {...assistant}
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
        {...assistant}
        tag={{ label: t('failed'), tone: 'danger' }}
        outlined
        text={message.error || t('failedText')}
        {...common}
      />
    );

  const tables = message.data.tables ?? [];
  return (
    <MessageBubble
      {...assistant}
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
        className={`inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium disabled:opacity-50 ${
          pressed
            ? value === 'right'
              ? 'bg-good-tint text-good'
              : 'bg-danger-tint text-danger'
            : 'text-text-2 hover:bg-surface hover:text-text'
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
      className="flex flex-wrap items-center gap-1"
    >
      <span className="pe-1 text-xs text-text-2">{t('feedback.label')}</span>
      {button('right')}
      {button('wrong')}
    </div>
  );
}

/** Earlier conversations: the pinned ones, then the rest, newest first, a page at a time. */
function ConversationList({ current }: { current: number | null }) {
  const { t } = useTranslation('assistant');
  const [page, setPage] = useState(1);
  const { data, isPending, isError, isPlaceholderData } = useQuery(conversationsQuery(page));

  if (isPending) return <SkeletonRows rows={3} />;
  if (isError) return <p className="m-0 px-3 text-sm text-text-2">{t('history.error')}</p>;
  if (data.results.length === 0)
    return <p className="m-0 px-3 text-sm leading-7 text-text-2">{t('history.empty')}</p>;

  const pinned = data.results.filter((row) => row.pinned);
  const recent = data.results.filter((row) => !row.pinned);
  return (
    <div className="flex flex-col gap-4">
      {pinned.length > 0 && (
        <ConversationGroup title={t('history.pinned')} rows={pinned} current={current} />
      )}
      {recent.length > 0 && (
        <ConversationGroup title={t('history.recent')} rows={recent} current={current} />
      )}
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

function ConversationGroup({
  title,
  rows,
  current,
}: {
  title: string;
  rows: ConversationRow[];
  current: number | null;
}) {
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-0.5">
      <h3 id={titleId} className="m-0 px-3 py-1.5 text-xs font-semibold text-text-2">
        {title}
      </h3>
      <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
        {rows.map((row) => (
          <ConversationItem key={row.id} conversation={row} active={row.id === current} />
        ))}
      </ul>
    </section>
  );
}

/** One conversation: a link, and (where the server has them) pin and rename. */
function ConversationItem({
  conversation,
  active,
}: {
  conversation: ConversationRow;
  active: boolean;
}) {
  const { t } = useTranslation('assistant');
  const f = useFormat();
  const change = useChangeConversation();
  const [renaming, setRenaming] = useState(false);
  const title = conversation.title || t('history.untitled');
  const pinned = conversation.pinned ?? false;
  const organize = ON_SERVER.assistantOrganize;

  if (renaming)
    return (
      <li>
        <RenameForm conversation={conversation} onDone={() => setRenaming(false)} />
      </li>
    );

  const togglePin = () =>
    change.mutate(
      { id: conversation.id, pinned: !pinned },
      {
        onSuccess: () => toast.success(t(pinned ? 'history.unpinDone' : 'history.pinDone')),
        onError: () => toast.error(t('history.changeError')),
      },
    );

  return (
    <li className="group/row relative">
      <Link
        to={conversationPath(conversation.id)}
        aria-current={active ? 'page' : undefined}
        className={`flex min-h-11 flex-col justify-center gap-0.5 rounded-xl px-3 py-2 ${
          active ? 'bg-tint' : 'hover:bg-canvas'
        } ${organize ? 'group-focus-within/row:pe-24 group-hover/row:pe-24 [@media(hover:none)]:pe-24' : ''}`}
      >
        <span className="flex min-w-0 items-center gap-1.5 text-sm font-medium">
          {pinned && <Icon name="pin" size={14} className="flex-none text-text-2" />}
          <span className="truncate">{title}</span>
        </span>
        <span className="text-xs text-text-2">{f.date(conversation.updated_at)}</span>
      </Link>
      {organize && (
        <span className="absolute inset-y-0 end-1 flex items-center opacity-0 group-focus-within/row:opacity-100 group-hover/row:opacity-100 [@media(hover:none)]:opacity-100">
          <IconButton
            icon="pin"
            iconSize={17}
            tone="muted"
            aria-label={t(pinned ? 'history.unpin' : 'history.pin', { title })}
            disabled={change.isPending}
            onClick={togglePin}
          />
          <IconButton
            icon="pen"
            iconSize={17}
            tone="muted"
            aria-label={t('history.rename', { title })}
            onClick={() => setRenaming(true)}
          />
        </span>
      )}
    </li>
  );
}

/** The conversation's name in a box: Enter or ✓ saves, Escape or ✕ leaves it as it was. */
function RenameForm({
  conversation,
  onDone,
}: {
  conversation: ConversationRow;
  onDone: () => void;
}) {
  const { t } = useTranslation('assistant');
  const change = useChangeConversation();
  const [value, setValue] = useState(conversation.title);
  const input = useRef<HTMLInputElement>(null);
  const inputId = useId();

  useEffect(() => {
    input.current?.focus();
    input.current?.select();
  }, []);

  const save = () => {
    const title = value.trim();
    if (!title || title === conversation.title) {
      onDone();
      return;
    }
    change.mutate(
      { id: conversation.id, title },
      {
        onSuccess: () => {
          toast.success(t('history.renamed'));
          onDone();
        },
        onError: () => toast.error(t('history.changeError')),
      },
    );
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
      className="flex items-center rounded-xl bg-canvas ps-3 shadow-[inset_0_0_0_1.5px_var(--primary)]"
    >
      <label htmlFor={inputId} className="sr-only">
        {t('history.renameLabel')}
      </label>
      <input
        ref={input}
        id={inputId}
        value={value}
        maxLength={128}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== 'Escape') return;
          event.preventDefault();
          event.stopPropagation();
          onDone();
        }}
        className="min-h-11 min-w-0 flex-1 bg-transparent text-sm text-text outline-0"
      />
      <IconButton
        type="submit"
        icon="check"
        iconSize={17}
        aria-label={t('history.save')}
        disabled={change.isPending}
      />
      <IconButton
        icon="close"
        iconSize={17}
        tone="muted"
        aria-label={t('cancel')}
        onClick={onDone}
      />
    </form>
  );
}

/** What went wrong with a question, for the toast: still answering, too many questions, or else. */
function askError(error: unknown) {
  if (error instanceof ApiError && error.status === 409) return 'errors.busy' as const;
  if (error instanceof ApiError && error.status === 429) return 'errors.tooMany' as const;
  return 'errors.failed' as const;
}
