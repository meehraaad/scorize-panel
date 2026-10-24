import { useState, type SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { ChoiceGroup, SelectField, TextAreaField } from '@/components/ui/Choices';
import { Dialog } from '@/components/ui/Dialog';
import { Notice } from '@/components/ui/Notice';
import { SectionCard } from '@/components/ui/SectionCard';
import { useFormat } from '@/lib/i18n/useFormat';
import { TASKS_KEY, useCreateTask, type Colleague, type SentRequest } from '@/lib/tasks/api';
import { quickWhen } from '@/lib/when';
import type { TasksConfig } from '../config';
import { STATUS_TONE } from './status';

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
        panel={config.panel}
        onClose={() => setOpen(false)}
      />
    </SectionCard>
  );
}

function InternalRequestDialog({
  open,
  colleagues,
  panel,
  onClose,
}: {
  open: boolean;
  colleagues: Colleague[];
  panel: TasksConfig['panel'];
  onClose: () => void;
}) {
  const { t } = useTranslation('tasks');
  const create = useCreateTask(TASKS_KEY, panel);
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
      { onSuccess: onClose },
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
        {create.isError && <Notice tone="error">{t('error')}</Notice>}
      </form>
    </Dialog>
  );
}

/** Requests I sent, and how far each got. */
export function SentCard({ sent }: { sent: SentRequest[] }) {
  const { t } = useTranslation('tasks');
  const f = useFormat();
  return (
    <SectionCard id="tasks-sent" variant="panel" title={t('sent.title')}>
      {sent.length === 0 ? (
        <p className="m-0 text-sm text-text-2">{t('sent.empty')}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {sent.map((item) => (
            <li key={item.id} className="flex items-start justify-between gap-3">
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">{item.text}</span>
                <span className="text-xs text-text-2">
                  {t('sent.to', {
                    to: 'name' in item.to ? item.to.name : t(`team.name.${item.to.team}`),
                    when: f.timeAgo(item.at),
                  })}
                </span>
              </span>
              <Chip tone={STATUS_TONE[item.status]} small>
                {t(`status.${item.status}`)}
              </Chip>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
