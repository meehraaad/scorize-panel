import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState, type SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { TextAreaField } from '@/components/ui/Choices';
import { Dialog } from '@/components/ui/Dialog';
import { ProgressBar, StepBar } from '@/components/ui/Progress';
import { Icon } from '@/components/ui/Icon';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { useFormat } from '@/lib/i18n/useFormat';
import { type RequestDetail } from '@/lib/tasks/api';
import { requestQuery, useTaskChange } from '@/lib/tasks/changes';
import type { TasksConfig } from '../config';
import { PersonRef } from './PersonRef';
import { ReactionBar } from './Reactions';
import { StatusMark } from './StatusMark';
import { toast } from '@/lib/toast';

const STEPS = ['sent', 'seen', 'in_progress', 'done'] as const;
/** Old requests went to dozens of people: name a few and count the rest. */
const WATCHERS_SHOWN = 3;

/**
 * A colleague's request: its steps, what they wrote, the conversation, and finishing it (they are
 * told) or refusing it with a reason. Canvas "جزئیات درخواست همکار". `sent`: a request I sent,
 * opened to follow it and talk; only who does it finishes or refuses it. `followUp`: any other task
 * row (my follow-ups, a queue), opened for its conversation and reactions.
 */
export function RequestDialog({
  id,
  config,
  sent = false,
  followUp = false,
  onClose,
}: {
  id: number | null;
  config: TasksConfig;
  sent?: boolean;
  /** One of my follow-ups or a queue task: its notes and reactions; done from the list. */
  followUp?: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation('tasks');
  const f = useFormat();
  const { data } = useQuery({ ...requestQuery(config.panel, id ?? 0), enabled: id !== null });
  const change = useTaskChange();
  const [message, setMessage] = useState('');
  const messageRef = useRef<HTMLTextAreaElement>(null);
  const [refusing, setRefusing] = useState(false);
  const [reason, setReason] = useState('');
  // Read once: whether it is late doesn't need to move while it is open.
  const [now] = useState(() => Date.now());

  const send = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!id || !message.trim()) return;
    change.mutate(
      { id, change: { kind: 'comment', text: message.trim() } },
      { onError: () => toast.error(t('error')), onSuccess: () => setMessage('') },
    );
  };
  const finish = (status: 'done' | 'rejected') =>
    id &&
    change.mutate(
      {
        id,
        change: {
          kind: 'status',
          status,
          ...(status === 'rejected' ? { reason: reason.trim() } : {}),
        },
      },
      { onError: () => toast.error(t('error')), onSuccess: onClose },
    );
  const first = data?.from.name.split(' ')[0] ?? '';
  const current = data ? Math.max(1, STEPS.indexOf(data.status as (typeof STEPS)[number])) : 0;
  const closed = data?.status === 'done' || data?.status === 'rejected';

  const late = data ? new Date(data.due_at).getTime() < now && !closed : false;
  const pending =
    change.isPending && change.variables.change.kind === 'comment'
      ? change.variables.change.text
      : null;
  const failed = change.isError && change.variables.change.kind === 'comment';
  // Who it is between: whoever gave it (or the system), or whom I sent it to.
  const between = !data
    ? ''
    : data.role === 'creator'
      ? data.watchers.length > WATCHERS_SHOWN
        ? t('requests.watchersMany', {
            names: f.list(data.watchers.slice(0, WATCHERS_SHOWN)),
            n: f.number(data.watchers.length - WATCHERS_SHOWN),
          })
        : f.list(data.watchers)
      : data.origin === 'system'
        ? t('requests.origin.system')
        : data.from.name || t('requests.origin.self');

  return (
    <Dialog
      open={id !== null}
      onClose={onClose}
      title={data?.text ?? t('requests.loading')}
      closeLabel={t('close')}
      footer={
        data &&
        !closed &&
        !sent &&
        !followUp &&
        (refusing ? (
          <>
            {/* The reason sits with its button, where the eye already is (not under the conversation). */}
            <div className="basis-full">
              <TextAreaField
                label={t('requests.reason')}
                rows={2}
                autoFocus
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </div>
            <Button
              variant="danger"
              className="flex-1"
              disabled={!reason.trim() || change.isPending}
              onClick={() => finish('rejected')}
            >
              {t('requests.refuse')}
            </Button>
            <Button variant="outline" onClick={() => setRefusing(false)}>
              {t('cancel')}
            </Button>
          </>
        ) : (
          <>
            <Button className="flex-1" disabled={change.isPending} onClick={() => finish('done')}>
              {t('requests.doneTell', { name: first })}
            </Button>
            <Button variant="outline" onClick={() => setRefusing(true)}>
              {t('requests.refuseWithReason')}
            </Button>
          </>
        ))
      }
    >
      {!data ? (
        <SkeletonRows rows={3} />
      ) : (
        <>
          {/* What it is in one look: who set it, how far it got, between whom, when, and the penalty. */}
          <section
            aria-label={t('requests.summary')}
            className="flex flex-col gap-4 rounded-card-sm bg-hero p-4 text-on-hero lg:p-5"
          >
            <span className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full bg-hero-raised px-3 py-1 text-xs font-bold ${
                  data.origin === 'system' ? 'text-hero-info' : 'text-on-hero-2'
                }`}
              >
                {t(`requests.origin.${data.origin}`)}
              </span>
              {data.person && (
                <span className="text-sm text-on-hero-2">
                  {t('requests.about')}{' '}
                  <PersonRef person={data.person} config={config} face={false} />
                </span>
              )}
            </span>
            {!followUp && (
              <StepBar
                tone="onHero"
                label={t('requests.steps')}
                steps={STEPS.map((step) => ({ key: step, label: t(`status.${step}`) }))}
                current={data.status === 'rejected' ? STEPS.length - 1 : current}
                finished={data.status === 'done'}
              />
            )}
            <dl className="m-0 grid grid-cols-3 gap-3 rounded-2xl bg-hero-raised p-3">
              <div className="flex min-w-0 flex-col gap-0.5">
                <dt className="text-xs text-on-hero-2">
                  {t(data.role === 'creator' ? 'requests.to' : 'requests.by')}
                </dt>
                <dd className="m-0 truncate text-sm font-bold">{between}</dd>
              </div>
              <div className="flex min-w-0 flex-col gap-0.5">
                <dt className="text-xs text-on-hero-2">{t('requests.dueLabel')}</dt>
                <dd className={`m-0 text-sm font-bold ${late ? 'text-hero-danger' : ''}`}>
                  {data.timed === false ? f.date(data.due_at) : f.dateTime(data.due_at)}
                </dd>
              </div>
              <div className="flex min-w-0 flex-col gap-0.5">
                <dt className="text-xs text-on-hero-2">{t('requests.penalty')}</dt>
                <dd
                  className={`m-0 text-sm font-bold ${data.penalty ? 'text-hero-current' : 'text-on-hero-2'}`}
                >
                  {t(data.penalty ? 'requests.penaltyOn' : 'requests.penaltyOff')}
                </dd>
              </div>
            </dl>
          </section>
          {data.people.length > 0 && <People people={data.people} />}
          <section
            aria-labelledby="request-thread"
            className="-mx-5 -mb-6 flex flex-1 flex-col gap-3 bg-canvas px-5 pt-4 lg:-mx-7 lg:px-7"
          >
            <h3 id="request-thread" className="m-0 text-sm font-semibold text-text-2">
              {t('requests.thread')}
            </h3>
            {data.thread.length === 0 && pending === null && !data.body && (
              <p className="m-0 py-4 text-center text-sm text-text-2">
                {t(closed ? 'requests.noThread' : 'requests.startThread')}
              </p>
            )}
            <ul className="m-0 flex list-none flex-col gap-3 p-0">
              {/* What the task says opens the conversation, with its reactions under it. */}
              {data.body && (
                <Bubble
                  mine={data.role === 'creator'}
                  meta={data.role === 'creator' ? t('requests.you') : between}
                  text={data.body}
                />
              )}
              <li className={data.body && data.role === 'creator' ? 'me-10' : 'ms-10 self-end'}>
                <ReactionBar panel={config.panel} id={data.id} reactions={data.reactions} compact />
              </li>
              {data.thread.map((comment) => (
                <Bubble
                  key={comment.id}
                  mine={comment.mine}
                  meta={`${comment.mine ? t('requests.you') : comment.author} · ${f.timeAgo(comment.at)}`}
                  text={comment.text}
                />
              ))}
              {pending !== null && (
                <Bubble mine meta={t('requests.sending')} text={pending} faded />
              )}
            </ul>
            {failed && (
              <p role="alert" className="m-0 flex items-center gap-2 text-sm text-danger">
                {t('requests.notSent')}
                <button
                  type="submit"
                  form="request-message"
                  className="min-h-11 cursor-pointer px-1 font-bold text-primary-text"
                >
                  {t('requests.retry')}
                </button>
              </p>
            )}
            {!closed && (
              // Pinned to the bottom while the conversation scrolls: always at hand to answer.
              <form
                id="request-message"
                onSubmit={send}
                className="sticky bottom-0 -mx-5 mt-auto flex items-end gap-2 bg-canvas px-5 py-3 lg:-mx-7 lg:px-7"
              >
                <label htmlFor="request-message-text" className="sr-only">
                  {sent || followUp
                    ? t('requests.messageSent')
                    : t('requests.message', { name: first })}
                </label>
                <EmojiButton
                  onPick={(emoji) => {
                    const field = messageRef.current;
                    const at = field?.selectionStart ?? message.length;
                    const end = field?.selectionEnd ?? at;
                    setMessage(message.slice(0, at) + emoji + message.slice(end));
                    requestAnimationFrame(() => {
                      field?.focus();
                      field?.setSelectionRange(at + emoji.length, at + emoji.length);
                    });
                  }}
                />
                <textarea
                  ref={messageRef}
                  id="request-message-text"
                  rows={1}
                  value={message}
                  placeholder={
                    sent || followUp
                      ? t('requests.messageSent')
                      : t('requests.message', { name: first })
                  }
                  onChange={(event) => setMessage(event.target.value)}
                  className="field-sizing-content max-h-40 min-h-12 flex-1 resize-none rounded-3xl bg-surface px-4 py-3 text-base leading-6 shadow-[inset_0_0_0_1px_var(--line-2)] focus-visible:outline-2 focus-visible:outline-focus"
                />
                <button
                  type="submit"
                  aria-label={t('requests.send')}
                  disabled={!message.trim() || change.isPending}
                  className="flex size-12 flex-none cursor-pointer items-center justify-center rounded-full bg-primary text-on-primary disabled:cursor-default disabled:opacity-50"
                >
                  <Icon name="send" size={18} />
                </button>
              </form>
            )}
          </section>
        </>
      )}
    </Dialog>
  );
}

/** Emojis the composer offers: the reactions first, then a few everyday ones. */
const EMOJIS = ['👍', '✅', '🙏', '❤️', '👀', '🎉', '😊', '😂', '👌', '🙌', '🔥', '⏰', '📞', '✍️'];

/** The composer's emoji: a face that opens a small grid; a pick goes in at the caret. */
function EmojiButton({ onPick }: { onPick: (emoji: string) => void }) {
  const { t } = useTranslation('tasks');
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    box.current?.querySelector<HTMLButtonElement>('[role="group"] button')?.focus();
    const away = (event: PointerEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [open]);
  return (
    <div ref={box} className="relative flex-none">
      <button
        type="button"
        aria-expanded={open}
        aria-label={t('requests.emoji')}
        title={t('requests.emoji')}
        onClick={() => setOpen((value) => !value)}
        className="flex size-12 items-center justify-center rounded-full text-xl text-text-2 hover:bg-tint"
      >
        <span aria-hidden="true">🙂</span>
      </button>
      {open && (
        <div
          role="group"
          aria-label={t('requests.emoji')}
          onKeyDown={(event) => {
            if (event.key !== 'Escape') return;
            // Inside a dialog: Escape closes the grid, not the whole dialog.
            event.stopPropagation();
            setOpen(false);
          }}
          className="absolute start-0 bottom-14 z-20 grid w-max grid-cols-7 gap-1 rounded-2xl bg-surface p-1.5 shadow-panel"
        >
          {EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => {
                onPick(emoji);
                setOpen(false);
              }}
              className="size-10 rounded-xl text-xl hover:bg-canvas"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** One message: mine on the start side in the brand colour, others' on the end side. */
function Bubble({
  mine,
  meta,
  text,
  faded = false,
}: {
  mine: boolean;
  meta: string;
  text: string;
  faded?: boolean;
}) {
  return (
    <li
      className={`flex flex-col gap-1 ${mine ? 'ms-0 me-10 items-start' : 'ms-10 me-0 items-end'} ${faded ? 'opacity-60' : ''}`}
    >
      <span className="text-xs text-text-2">{meta}</span>
      <span
        className={`rounded-2xl px-4 py-2.5 text-[15px] leading-7 [overflow-wrap:anywhere] whitespace-pre-line ${
          mine
            ? 'rounded-ss-md bg-primary text-on-primary'
            : 'rounded-se-md bg-surface shadow-[inset_0_0_0_1px_var(--hair)]'
        }`}
      >
        {text}
      </span>
    </li>
  );
}

/** A request sent to several people: how many have done it, and each one's step. */
function People({ people }: { people: RequestDetail['people'] }) {
  const { t } = useTranslation('tasks');
  const f = useFormat();
  const done = people.filter((person) => person.status === 'done').length;
  return (
    <section aria-labelledby="request-people" className="flex flex-col gap-2.5">
      <h3 id="request-people" className="m-0 text-sm font-semibold text-text-2">
        {t('people.done', { done: f.number(done), total: f.number(people.length) })}
      </h3>
      <ProgressBar value={Math.round((done / people.length) * 100)} tone="good" size="sm" />
      <ul className="m-0 flex max-h-64 list-none flex-col overflow-y-auto p-0">
        {people.map((person, index) => (
          <li
            key={`${person.name}-${String(index)}`}
            className="flex min-h-10 items-center justify-between gap-3 py-1 text-sm"
          >
            <span className="min-w-0 truncate">{person.name}</span>
            <StatusMark status={person.status} />
          </li>
        ))}
      </ul>
    </section>
  );
}
