import { useState, type SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { ChoiceGroup, SelectField, TextAreaField } from '@/components/ui/Choices';
import { Dialog } from '@/components/ui/Dialog';
import { SectionCard } from '@/components/ui/SectionCard';
import { useFormat } from '@/lib/i18n/useFormat';
import { TASKS_KEY, useCreateTask, type Colleague, type SentRequest } from '@/lib/tasks/api';
import { quickWhen } from '@/lib/when';
import type { TasksConfig } from '../config';
import { RequestDialog } from './RequestDialog';
import { StatusMark } from './StatusMark';
import { toast } from '@/lib/toast';

const WHENS = ['evening', 'tomorrow', 'week'] as const;

/** Tasks about a person start on their page; this is for internal ones with nobody to attach. */
export function InternalRequestCard({
  colleagues,
  config,
}: {
  colleagues: Colleague[];
  config: TasksConfig;
}) {
  const { t } = useTranslation('tasks');
  const [open, setOpen] = useState(false);
  return (
    <SectionCard id="tasks-new" variant="panel" title={t('internal.title')}>
      <p className="m-0 text-sm leading-7 text-neutral">{t(`internal.text.${config.person}`)}</p>
      <Button variant="outline" className="self-start" onClick={() => setOpen(true)}>
        {t('internal.open')}
      </Button>
      <InternalRequestDialog
        key={open ? 'open' : 'closed'}
        open={open}
        colleagues={colleagues}
        onClose={() => setOpen(false)}
      />
    </SectionCard>
  );
}

function InternalRequestDialog({
  open,
  colleagues,
  onClose,
}: {
  open: boolean;
  colleagues: Colleague[];
  onClose: () => void;
}) {
  const { t } = useTranslation('tasks');
  const create = useCreateTask(TASKS_KEY);
  const [text, setText] = useState('');
  const [peer, setPeer] = useState(String(colleagues[0]?.id ?? ''));
  const [when, setWhen] = useState<(typeof WHENS)[number]>('tomorrow');
  const [checked, setChecked] = useState(false);

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setChecked(true);
    if (!text.trim() || !peer) return;
    create.mutate(
      {
        user: null,
        kind: 'request',
        text: text.trim(),
        assignee: Number(peer),
        due_at: quickWhen(when).toISOString(),
      },
      { onError: () => toast.error(t('error')), onSuccess: onClose },
    );
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('internal.title')}
      closeLabel={t('close')}
      footer={
        <>
          <Button type="submit" form="internal-request" disabled={create.isPending}>
            {t('internal.send')}
          </Button>
          <Button variant="outline" onClick={onClose}>
            {t('cancel')}
          </Button>
        </>
      }
    >
      <form id="internal-request" noValidate onSubmit={submit} className="flex flex-col gap-5">
        <TextAreaField
          label={t('internal.what')}
          rows={3}
          value={text}
          onChange={(event) => setText(event.target.value)}
          hint={checked && !text.trim() ? t('internal.required') : undefined}
        />
        <SelectField
          label={t('internal.to')}
          value={peer}
          onChange={setPeer}
          options={colleagues.map((colleague) => ({
            value: String(colleague.id),
            label: `${colleague.name} · ${colleague.role}`,
          }))}
        />
        <ChoiceGroup
          legend={t('internal.due')}
          value={when}
          onChange={setWhen}
          options={WHENS.map((value) => ({ value, label: t(`done.whenOption.${value}`) }))}
        />
      </form>
    </Dialog>
  );
}

/**
 * Requests I sent, and how far each got. A row opens the request with its conversation; long text
 * is cut to two lines and a long list of people to the first one and a count.
 */
export function SentCard({ sent, config }: { sent: SentRequest[]; config: TasksConfig }) {
  const { t } = useTranslation('tasks');
  const f = useFormat();
  const [open, setOpen] = useState<number | null>(null);
  const recipient = (to: SentRequest['to']) =>
    'team' in to
      ? t(`team.name.${to.team}`)
      : to.others > 0
        ? t('sent.toMany', { name: to.name, n: f.number(to.others) })
        : to.name;
  return (
    <SectionCard id="tasks-sent" variant="panel" title={t('sent.title')}>
      {sent.length === 0 ? (
        <p className="m-0 text-sm text-text-2">{t('sent.empty')}</p>
      ) : (
        <ul className="m-0 -mx-3 flex list-none flex-col p-0">
          {sent.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => setOpen(item.id)}
                className="flex min-h-11 w-full items-start justify-between gap-3 rounded-2xl px-3 py-2.5 text-start hover:bg-canvas"
              >
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="line-clamp-2 text-sm font-medium [overflow-wrap:anywhere]">
                    {item.text}
                  </span>
                  <span className="text-xs text-text-2">
                    {t('sent.to', { to: recipient(item.to), when: f.timeAgo(item.at) })}
                    {item.comments > 0 &&
                      ` · ${t('requests.comments', { n: f.number(item.comments) })}`}
                  </span>
                </span>
                <StatusMark status={item.status} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <RequestDialog
        key={open ?? 'closed'}
        id={open}
        config={config}
        sent
        onClose={() => setOpen(null)}
      />
    </SectionCard>
  );
}
