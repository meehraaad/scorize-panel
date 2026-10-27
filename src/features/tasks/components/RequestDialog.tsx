import { useQuery } from '@tanstack/react-query';
import { useState, type SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Button } from '@/components/ui/Button';
import { TextAreaField } from '@/components/ui/Choices';
import { Dialog } from '@/components/ui/Dialog';
import { StepBar } from '@/components/ui/Progress';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { useFormat } from '@/lib/i18n/useFormat';
import { requestQuery, useTaskChange } from '@/lib/tasks/api';
import type { TasksConfig } from '../config';
import { toast } from '@/lib/toast';

const STEPS = ['sent', 'seen', 'in_progress', 'done'] as const;
/** Old requests went to dozens of people: name a few and count the rest. */
const WATCHERS_SHOWN = 3;

/**
 * A colleague's request: its steps, what they wrote, the conversation, and finishing it (they are
 * told) or refusing it with a reason. Canvas "جزئیات درخواست همکار". `sent`: a request I sent,
 * opened to follow it and talk; only who does it finishes or refuses it.
 */
export function RequestDialog({
  id,
  config,
  sent = false,
  onClose,
}: {
  id: number | null;
  config: TasksConfig;
  sent?: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation('tasks');
  const f = useFormat();
  const { data } = useQuery({ ...requestQuery(config.panel, id ?? 0), enabled: id !== null });
  const change = useTaskChange();
  const [message, setMessage] = useState('');
  const [refusing, setRefusing] = useState(false);
  const [reason, setReason] = useState('');

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

  return (
    <Dialog
      open={id !== null}
      onClose={onClose}
      title={data?.text ?? t('requests.loading')}
      subtitle={
        data &&
        t('requests.from', {
          name: data.from.name,
          role: data.from.role,
          when: f.timeAgo(data.created_at),
        })
      }
      closeLabel={t('close')}
      footer={
        data &&
        !closed &&
        !sent &&
        (refusing ? (
          <>
            <Button
              variant="danger"
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
            <Button disabled={change.isPending} onClick={() => finish('done')}>
              {t('requests.doneTell', { name: first })}
            </Button>
            <Button variant="danger" onClick={() => setRefusing(true)}>
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
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-text-2">
            {data.person && (
              <span>
                {t('requests.about')}{' '}
                <Link to={config.personPath(data.person.id)} className="text-primary-text">
                  {data.person.name}
                </Link>
              </span>
            )}
            <span>{t('requests.due', { when: f.dateTime(data.due_at) })}</span>
            {data.watchers.length > 0 && (
              <span>
                {data.watchers.length > WATCHERS_SHOWN
                  ? t('requests.watchersMany', {
                      names: f.list(data.watchers.slice(0, WATCHERS_SHOWN)),
                      n: f.number(data.watchers.length - WATCHERS_SHOWN),
                    })
                  : t('requests.watchers', { names: f.list(data.watchers) })}
              </span>
            )}
          </div>
          <StepBar
            label={t('requests.steps')}
            steps={STEPS.map((step) => ({ key: step, label: t(`status.${step}`) }))}
            current={data.status === 'rejected' ? STEPS.length - 1 : current}
            finished={data.status === 'done'}
          />
          {data.body && (
            <p className="m-0 rounded-2xl bg-canvas p-4 text-[15px] leading-8 [overflow-wrap:anywhere] whitespace-pre-line">
              {data.body}
            </p>
          )}
          <section aria-labelledby="request-thread" className="flex flex-col gap-3">
            <h3 id="request-thread" className="m-0 text-sm font-semibold text-text-2">
              {t('requests.thread')}
            </h3>
            {data.thread.length === 0 && (
              <p className="m-0 text-sm text-text-2">{t('requests.noThread')}</p>
            )}
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {data.thread.map((comment) => (
                <li
                  key={comment.id}
                  className={`flex flex-col gap-1 rounded-2xl px-4 py-3 ${comment.mine ? 'ms-8 bg-tint' : 'me-8 bg-canvas'}`}
                >
                  <span className="text-xs text-text-2">
                    {`${comment.author} · ${f.timeAgo(comment.at)}`}
                  </span>
                  <span className="text-sm leading-7 [overflow-wrap:anywhere] whitespace-pre-line">
                    {comment.text}
                  </span>
                </li>
              ))}
            </ul>
            {!closed && (
              <form onSubmit={send} className="flex items-end gap-2">
                <div className="flex-1">
                  <TextAreaField
                    label={
                      sent ? t('requests.messageSent') : t('requests.message', { name: first })
                    }
                    rows={2}
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                  />
                </div>
                <Button
                  type="submit"
                  variant="outline"
                  disabled={!message.trim() || change.isPending}
                >
                  {t('requests.send')}
                </Button>
              </form>
            )}
          </section>
          {refusing && (
            <TextAreaField
              label={t('requests.reason')}
              rows={2}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          )}
        </>
      )}
    </Dialog>
  );
}
