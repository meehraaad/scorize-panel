import { useState, type SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { ChoiceGroup, SelectField, TextAreaField } from '@/components/ui/Choices';
import { Dialog } from '@/components/ui/Dialog';
import { Notice } from '@/components/ui/Notice';
import { TextField } from '@/components/ui/TextField';
import { useTaskChange, type MyTask, type TaskOutcome } from '@/lib/tasks/api';
import { quickWhen } from '@/lib/when';
import type { TasksConfig } from '../config';

const OUTCOMES = [
  'talked',
  'no_answer',
  'messaged',
  'later',
] as const satisfies readonly TaskOutcome[];
const WHENS = ['evening', 'tomorrow', 'three', 'week'] as const;
const ENDS = ['won', 'lost', 'finished'] as const;

/**
 * "Done" asks what happened and what comes next, so a person never ends up without a next step.
 * Closing without one needs a reason. Canvas "انجام شد ← قدم بعدی".
 */
export function DoneDialog({
  task,
  config,
  onClose,
}: {
  task: MyTask | null;
  config: TasksConfig;
  onClose: () => void;
}) {
  const { t } = useTranslation('tasks');
  const change = useTaskChange(config.panel);
  const [outcome, setOutcome] = useState<TaskOutcome>('talked');
  const [note, setNote] = useState(task?.note ?? '');
  const [next, setNext] = useState(task?.suggested_next ?? '');
  const [when, setWhen] = useState<(typeof WHENS)[number]>('tomorrow');
  const [ending, setEnding] = useState(false);
  const [end, setEnd] = useState<(typeof ENDS)[number]>('finished');
  const [checked, setChecked] = useState(false);

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setChecked(true);
    if (!task || (!ending && !next.trim())) return;
    change.mutate(
      {
        id: task.id,
        change: {
          kind: 'done',
          outcome,
          note: note.trim(),
          next: ending ? null : { text: next.trim(), due_at: quickWhen(when).toISOString() },
          ...(ending ? { end_reason: end } : {}),
        },
      },
      { onSuccess: onClose },
    );
  };

  return (
    <Dialog
      open={task !== null}
      onClose={onClose}
      title={t('done.title')}
      subtitle={task && [task.text, task.person?.name].filter(Boolean).join(' · ')}
      closeLabel={t('close')}
      footer={
        <>
          <Button type="submit" form="task-done" disabled={change.isPending}>
            {ending ? t('done.saveClose') : t('done.saveNext')}
          </Button>
          <Button variant="outline" onClick={onClose}>
            {t('cancel')}
          </Button>
        </>
      }
    >
      <form id="task-done" noValidate onSubmit={submit} className="flex flex-col gap-6">
        <ChoiceGroup
          legend={t('done.outcome')}
          look="tiles"
          value={outcome}
          onChange={setOutcome}
          options={OUTCOMES.map((value) => ({
            value,
            label: t(`done.outcomeOption.${config.person}.${value}`),
          }))}
        />
        <TextAreaField
          label={t('done.note')}
          hint={t(`done.noteHint.${config.person}`)}
          rows={3}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
        {ending ? (
          <SelectField
            label={t(`done.why.${config.person}`)}
            value={end}
            onChange={setEnd}
            options={ENDS.map((value) => ({ value, label: t(`done.end.${value}`) }))}
          />
        ) : (
          <div className="flex flex-col gap-4">
            <TextField
              label={t('done.next')}
              hint={t('done.suggested')}
              value={next}
              onChange={(event) => setNext(event.target.value)}
              error={checked && !next.trim() ? t('done.nextRequired') : undefined}
            />
            <ChoiceGroup
              legend={t('done.when')}
              value={when}
              onChange={setWhen}
              options={WHENS.map((value) => ({ value, label: t(`done.whenOption.${value}`) }))}
            />
          </div>
        )}
        <button
          type="button"
          onClick={() => setEnding(!ending)}
          className="min-h-11 self-start text-sm font-medium text-primary-text underline-offset-4 hover:underline"
        >
          {ending ? t('done.needNext') : t(`done.noNext.${config.person}`)}
        </button>
        {change.isError && <Notice tone="error">{t('error')}</Notice>}
      </form>
    </Dialog>
  );
}
