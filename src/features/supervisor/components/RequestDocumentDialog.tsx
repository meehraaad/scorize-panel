import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { TextAreaField } from '@/components/ui/Choices';
import { DatePicker } from '@/components/ui/DatePicker';
import { Dialog } from '@/components/ui/Dialog';
import { TextField } from '@/components/ui/TextField';
import { useRequestDocument } from '../api';
import { toast } from '@/lib/toast';

/** Asks the applicant for one more document (UploadRequiredDocument); they get an SMS. */
export function RequestDocumentDialog({
  caseId,
  open,
  onClose,
}: {
  caseId: number;
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation('supervisor');
  const request = useRequestDocument(caseId);
  const [name, setName] = useState('');
  const [deadline, setDeadline] = useState('');
  const [note, setNote] = useState('');

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('requestDialog.title')}
      subtitle={t('requestDialog.subtitle')}
      closeLabel={t('close')}
      footer={
        <>
          <Button
            disabled={!name.trim() || request.isPending}
            onClick={() =>
              request.mutate(
                { name: name.trim(), deadline: deadline || null, note: note.trim() },
                { onError: () => toast.error(t('saveError')), onSuccess: onClose },
              )
            }
          >
            {t('requestDialog.save')}
          </Button>
          <Button variant="outline" onClick={onClose}>
            {t('cancel')}
          </Button>
        </>
      }
    >
      <TextField
        label={t('requestDialog.name')}
        placeholder={t('requestDialog.namePlaceholder')}
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
      <DatePicker
        label={t('requestDialog.deadline')}
        value={deadline}
        onChange={setDeadline}
        only="future"
        clearable
      />
      <TextAreaField
        label={t('requestDialog.note')}
        value={note}
        onChange={(event) => setNote(event.target.value)}
        rows={3}
      />
    </Dialog>
  );
}
