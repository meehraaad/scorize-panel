import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { InlineConfirm } from '@/components/ui/InlineConfirm';
import { Switch } from '@/components/ui/Switch';
import { TextField } from '@/components/ui/TextField';
import { VariableField, VariablePreview } from '@/components/ui/VariableField';
import { unknownVariables } from '@/lib/messageVariables';
import { toast } from '@/lib/toast';
import {
  readyHistoryQuery,
  useAddReadyMessage,
  useDeleteReadyMessage,
  useSaveReadyMessage,
  type ReadyKind,
  type ReadyMessage,
} from '../api';
import { fieldError, useReadyVariables } from '../format';
import { History } from './History';

/** A new ready message, or one to change, turn off or delete (with its history). */
export function ReadyMessageDialog({
  kind,
  message,
  onClose,
}: {
  kind: ReadyKind;
  message: ReadyMessage | null;
  onClose: () => void;
}) {
  const { t } = useTranslation('messages');
  const variables = useReadyVariables();
  const add = useAddReadyMessage();
  const saveExisting = useSaveReadyMessage(message?.id ?? 0);
  const remove = useDeleteReadyMessage(message?.id ?? 0);
  const history = useQuery({ ...readyHistoryQuery(message?.id ?? 0), enabled: message !== null });
  const [title, setTitle] = useState(message?.title ?? '');
  const [text, setText] = useState(message?.text ?? '');
  const [active, setActive] = useState(message?.is_active ?? true);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const save = message ? saveExisting : add;

  const unknown = unknownVariables(text, variables);
  const textError =
    unknown === null
      ? t('detail.openBrace')
      : unknown.length > 0
        ? t('detail.unknown', { names: unknown.map((name) => `{${name}}`).join('، ') })
        : fieldError(save.error, 'text');
  const changed =
    !message ||
    title.trim() !== message.title ||
    text !== message.text ||
    active !== message.is_active;
  const ready = title.trim() !== '' && text.trim() !== '' && textError === undefined;

  const submit = () =>
    save.mutate(
      { kind, title: title.trim(), text, is_active: active },
      {
        onSuccess: () => {
          toast.success(t(message ? 'ready.saved' : 'ready.added'));
          onClose();
        },
        onError: () => toast.error(t('saveError')),
      },
    );

  return (
    <Dialog
      open
      onClose={onClose}
      title={message ? message.title : t('ready.new')}
      subtitle={t(`ready.kind.${kind}`)}
      closeLabel={t('close')}
      footer={
        <Button disabled={!changed || !ready || save.isPending} onClick={submit}>
          {t(message ? 'detail.save' : 'ready.addButton')}
        </Button>
      }
    >
      <div className="flex flex-col gap-5">
        <TextField
          label={t('ready.name')}
          hint={t('ready.nameHint')}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={64}
        />
        <VariableField
          label={t('detail.text')}
          error={textError}
          value={text}
          onChange={setText}
          variables={variables}
          variablesLabel={t('detail.addVariable')}
        />
        {text.trim() && (
          <VariablePreview label={t('detail.preview')} text={text} variables={variables} />
        )}
        <Switch
          label={t('ready.active')}
          description={t(`ready.activeHint.${kind}`)}
          checked={active}
          onChange={setActive}
        />
        {message &&
          (confirmDelete ? (
            <InlineConfirm
              message={t('ready.deleteConfirm', { title: message.title })}
              confirmLabel={t('ready.deleteButton')}
              cancelLabel={t('cancel')}
              pending={remove.isPending}
              onCancel={() => setConfirmDelete(false)}
              onConfirm={() =>
                remove.mutate(undefined, {
                  onSuccess: () => {
                    toast.success(t('ready.deleted', { title: message.title }));
                    onClose();
                  },
                  onError: () => toast.error(t('saveError')),
                })
              }
            />
          ) : (
            <Button variant="danger" className="self-start" onClick={() => setConfirmDelete(true)}>
              {t('ready.delete')}
            </Button>
          ))}
        {message && history.data && (
          <History
            id={`ready-${String(message.id)}`}
            changes={history.data}
            onRestore={(version) => {
              setTitle(version.title);
              setText(version.text);
            }}
          />
        )}
      </div>
    </Dialog>
  );
}
