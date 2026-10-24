import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { TextAreaField } from '@/components/ui/Choices';
import { DatePicker } from '@/components/ui/DatePicker';
import { Dialog } from '@/components/ui/Dialog';
import { Notice } from '@/components/ui/Notice';
import { useCreateTask } from '@/lib/tasks/api';
import { fromLocalInput } from '@/lib/when';
import { caseKey } from '../api';

/** A follow-up of my own about this applicant (StaffToDo, docs/backend-changes.md T2). */
export function NewTaskDialog({
  caseId,
  user,
  name,
  open,
  onClose,
}: {
  caseId: number;
  user: number;
  name: string;
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation('supervisor');
  const create = useCreateTask(caseKey(caseId));
  const [text, setText] = useState('');
  const [due, setDue] = useState('');
  const dueAt = fromLocalInput(due);
  const ready = text.trim().length > 0 && dueAt !== null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('taskDialog.title')}
      subtitle={name}
      closeLabel={t('close')}
      footer={
        <>
          <Button
            disabled={!ready || create.isPending}
            onClick={() => {
              if (!dueAt) return;
              create.mutate(
                { user, text: text.trim(), kind: 'mine', due_at: dueAt },
                { onSuccess: onClose },
              );
            }}
          >
            {t('taskDialog.save')}
          </Button>
          <Button variant="outline" onClick={onClose}>
            {t('cancel')}
          </Button>
        </>
      }
    >
      {create.isError && <Notice tone="error">{t('saveError')}</Notice>}
      <TextAreaField
        label={t('taskDialog.text')}
        placeholder={t('taskDialog.placeholder')}
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={3}
      />
      <DatePicker label={t('taskDialog.due')} value={due} onChange={setDue} time only="future" />
    </Dialog>
  );
}
