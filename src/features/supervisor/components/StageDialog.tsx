import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { ChoiceGroup, TextAreaField } from '@/components/ui/Choices';
import { Dialog } from '@/components/ui/Dialog';
import { Notice } from '@/components/ui/Notice';
import { CASE_STAGES, useChangeStage, type CaseStage } from '../api';

/** Moves the case to another stage, with an optional note for its history. */
export function StageDialog({
  caseId,
  name,
  stage,
  open,
  onClose,
}: {
  caseId: number;
  name: string;
  stage: CaseStage;
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation('supervisor');
  const change = useChangeStage(caseId);
  const [picked, setPicked] = useState<CaseStage>(stage);
  const [note, setNote] = useState('');

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('stageDialog.title')}
      subtitle={name}
      closeLabel={t('close')}
      footer={
        <>
          <Button
            disabled={picked === stage || change.isPending}
            onClick={() =>
              change.mutate({ stage: picked, note: note.trim() }, { onSuccess: onClose })
            }
          >
            {t('stageDialog.save')}
          </Button>
          <Button variant="outline" onClick={onClose}>
            {t('cancel')}
          </Button>
        </>
      }
    >
      {change.isError && <Notice tone="error">{t('saveError')}</Notice>}
      <ChoiceGroup
        legend={t('stageDialog.legend')}
        look="tiles"
        value={picked}
        onChange={setPicked}
        options={CASE_STAGES.map((value) => ({
          value,
          label: t(`stage.${value}`),
          hint: t(`stageHint.${value}`),
        }))}
      />
      <TextAreaField
        label={t('stageDialog.note')}
        hint={t('stageDialog.noteHint')}
        value={note}
        onChange={(event) => setNote(event.target.value)}
        rows={3}
      />
    </Dialog>
  );
}
