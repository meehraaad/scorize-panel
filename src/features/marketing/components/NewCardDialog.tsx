import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { SelectField } from '@/components/ui/Choices';
import { DatePicker } from '@/components/ui/DatePicker';
import { Dialog } from '@/components/ui/Dialog';
import { TextField } from '@/components/ui/TextField';
import { fieldErrors } from '@/lib/api/fieldErrors';
import { toast } from '@/lib/toast';
import { useUser } from '@/lib/auth/session';
import { ownerChoices, refusalOf, useNewCard, type BoardData } from '../boardApi';

const NONE = 'none';

/** A new card: its title, type (its checklist comes with it), owner, start stage and publish time. */
export default function NewCardDialog({
  board,
  me,
  onClose,
  onCreated,
}: {
  board: BoardData;
  /** My SupportStaff id, the default owner (null when I'm not one of the people). */
  me: number | null;
  onClose: () => void;
  onCreated: (id: number) => void;
}) {
  const { t } = useTranslation('marketing');
  const user = useUser();
  const create = useNewCard();
  const types = board.types.filter((item) => item.is_active);
  const [title, setTitle] = useState('');
  const [type, setType] = useState(types[0] ? String(types[0].id) : NONE);
  const [owner, setOwner] = useState(me === null ? NONE : String(me));
  const [stage, setStage] = useState(String(board.stages[0]?.id ?? ''));
  const [publishAt, setPublishAt] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const idOf = (value: string) => (value === NONE ? null : Number(value));

  const submit = () =>
    create.mutate(
      {
        title: title.trim(),
        type: idOf(type),
        owner: idOf(owner),
        stage: Number(stage),
        publish_at: publishAt ? new Date(publishAt).toISOString() : null,
      },
      {
        onSuccess: (card) => {
          toast.success(t('card.new.created'));
          onCreated(card.id);
        },
        onError: (error) => {
          setErrors(fieldErrors(error));
          if (refusalOf(error)?.code === 'limit') toast.error(t('board.full'));
          else if (Object.keys(fieldErrors(error)).length === 0) toast.error(t('card.error'));
        },
      },
    );

  return (
    <Dialog
      open
      onClose={onClose}
      title={t('card.new.title')}
      subtitle={t('card.new.checklistFromType')}
      closeLabel={t('card.close')}
      footer={
        <>
          <Button disabled={create.isPending || !title.trim()} onClick={submit}>
            {t('card.new.create')}
          </Button>
          <Button variant="outline" onClick={onClose}>
            {t('card.cancel')}
          </Button>
        </>
      }
    >
      <TextField
        label={t('card.title')}
        value={title}
        maxLength={160}
        error={errors.title}
        onChange={(event) => setTitle(event.target.value)}
      />
      <SelectField
        label={t('card.type')}
        value={type}
        onChange={setType}
        options={[
          ...types.map((item) => ({ value: String(item.id), label: item.name })),
          { value: NONE, label: t('card.noType') },
        ]}
      />
      <SelectField
        label={t('card.owner')}
        value={owner}
        onChange={setOwner}
        options={[
          { value: NONE, label: t('card.noOwner') },
          ...ownerChoices(board.people, user).map((person) => ({
            value: String(person.id),
            label: person.name,
          })),
        ]}
      />
      <SelectField
        label={t('card.new.stage')}
        value={stage}
        onChange={setStage}
        error={errors.stage}
        options={board.stages.map((item) => ({ value: String(item.id), label: item.name }))}
      />
      <DatePicker
        label={t('card.publishAt')}
        time
        clearable
        only="future"
        value={publishAt}
        onChange={setPublishAt}
        error={errors.publish_at}
      />
    </Dialog>
  );
}
