import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import { InlineConfirm } from '@/components/ui/InlineConfirm';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { TextField } from '@/components/ui/TextField';
import { VariableField, VariablePreview } from '@/components/ui/VariableField';
import { ApiError } from '@/lib/api/client';
import { unknownVariables, type FieldVariable } from '@/lib/messageVariables';
import { toast } from '@/lib/toast';
import {
  ownReadyMessagesQuery,
  useAddOwnReadyMessage,
  useDeleteOwnReadyMessage,
  useSaveOwnReadyMessage,
  type OwnReadyMessage,
} from '../api/readyMessages';

const rowClass =
  'flex w-full items-center gap-4 py-3.5 text-start shadow-[inset_0_1px_0_var(--hair)] hover:bg-canvas';

/**
 * Settings: the seller's own ready messages (WhatsApp, Telegram, SMS from a customer's page), with
 * the same variable buttons as management's. Management's ones are listed under them, to read only.
 */
export function MyReadyMessages() {
  const { t } = useTranslation('sales');
  const { data } = useQuery(ownReadyMessagesQuery);
  const [open, setOpen] = useState<OwnReadyMessage | 'new' | null>(null);
  const full = data ? data.own.length >= data.max : true;

  return (
    <section aria-labelledby="my-ready-title" aria-busy={!data} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="my-ready-title" className="m-0 font-display text-lg font-bold">
          {t('myReady.title')}
        </h2>
        <Button variant="outline" disabled={full} onClick={() => setOpen('new')}>
          <Icon name="plus" size={18} />
          {t('myReady.add')}
        </Button>
      </div>
      <p className="m-0 text-sm leading-7 text-text-2">{t('myReady.intro')}</p>
      {!data ? (
        <SkeletonRows rows={2} />
      ) : (
        <>
          {data.own.length === 0 ? (
            <EmptyState>{t('myReady.empty')}</EmptyState>
          ) : (
            <ul className="m-0 list-none p-0">
              {data.own.map((message) => (
                <li key={message.id}>
                  <button
                    type="button"
                    onClick={() => setOpen(message)}
                    aria-label={t('myReady.open', { title: message.title })}
                    className={rowClass}
                  >
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="text-[15px] font-semibold">{message.title}</span>
                      <span className="truncate text-[13px] text-text-2">{message.text}</span>
                    </span>
                    <Icon name="chevronEnd" size={18} className="text-text-3" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {full && (
            <p className="m-0 text-sm text-text-2">{t('myReady.full', { count: data.max })}</p>
          )}
          {data.shared.length > 0 && (
            <details className="group mt-2">
              <summary className="flex min-h-11 cursor-pointer items-center gap-2 text-[15px] font-medium text-text-2">
                <Icon
                  name="chevronDown"
                  size={16}
                  className="transition-transform group-open:rotate-180"
                />
                {t('myReady.shared', { count: data.shared.length })}
              </summary>
              <p className="m-0 text-sm leading-7 text-text-2">{t('myReady.sharedHint')}</p>
              <ul className="m-0 list-none p-0">
                {data.shared.map((message) => (
                  <li
                    key={message.id}
                    className="flex flex-col gap-0.5 py-3 shadow-[inset_0_1px_0_var(--hair)]"
                  >
                    <span className="text-[15px] font-semibold">{message.title}</span>
                    <span className="text-[13px] leading-6 whitespace-pre-line text-text-2">
                      {message.text}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
      {open && data && (
        <MyReadyDialog
          message={open === 'new' ? null : open}
          variables={data.variables}
          onClose={() => setOpen(null)}
        />
      )}
    </section>
  );
}

/** Django's own words for an invalid field (`{"text": ["…"]}`), if it sent any. */
function fieldError(error: unknown, field: string): string | undefined {
  if (!(error instanceof ApiError) || error.status !== 400) return undefined;
  const value = (error.body as Record<string, unknown> | null)?.[field];
  return Array.isArray(value) && typeof value[0] === 'string' ? value[0] : undefined;
}

function MyReadyDialog({
  message,
  variables,
  onClose,
}: {
  message: OwnReadyMessage | null;
  variables: readonly FieldVariable[];
  onClose: () => void;
}) {
  const { t } = useTranslation('sales');
  const add = useAddOwnReadyMessage();
  const saveExisting = useSaveOwnReadyMessage(message?.id ?? 0);
  const remove = useDeleteOwnReadyMessage(message?.id ?? 0);
  const save = message ? saveExisting : add;
  const [title, setTitle] = useState(message?.title ?? '');
  const [text, setText] = useState(message?.text ?? '');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const unknown = unknownVariables(text, variables);
  const textError =
    unknown === null
      ? t('myReady.openBrace')
      : unknown.length > 0
        ? t('myReady.unknown', { names: unknown.map((name) => `{${name}}`).join('، ') })
        : fieldError(save.error, 'text');
  const changed = !message || title.trim() !== message.title || text !== message.text;
  const ready = title.trim() !== '' && text.trim() !== '' && textError === undefined;

  const submit = () =>
    save.mutate(
      { title: title.trim(), text },
      {
        onSuccess: () => {
          toast.success(t(message ? 'myReady.saved' : 'myReady.added'));
          onClose();
        },
        onError: (error) =>
          toast.error(
            error instanceof ApiError && error.status === 409
              ? t('myReady.fullError')
              : t('myReady.error'),
          ),
      },
    );

  return (
    <Dialog
      open
      onClose={onClose}
      title={message ? message.title : t('myReady.new')}
      subtitle={t('myReady.subtitle')}
      closeLabel={t('myReady.close')}
      footer={
        <Button disabled={!changed || !ready || save.isPending} onClick={submit}>
          {t(message ? 'myReady.save' : 'myReady.addButton')}
        </Button>
      }
    >
      <div className="flex flex-col gap-5">
        <TextField
          label={t('myReady.name')}
          hint={t('myReady.nameHint')}
          error={fieldError(save.error, 'title')}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={64}
        />
        <VariableField
          label={t('myReady.text')}
          error={textError}
          value={text}
          onChange={setText}
          variables={variables}
          variablesLabel={t('myReady.addVariable')}
        />
        {text.trim() && (
          <VariablePreview label={t('myReady.preview')} text={text} variables={variables} />
        )}
        {message &&
          (confirmDelete ? (
            <InlineConfirm
              message={t('myReady.deleteConfirm', { title: message.title })}
              confirmLabel={t('myReady.deleteButton')}
              cancelLabel={t('myReady.cancel')}
              pending={remove.isPending}
              onCancel={() => setConfirmDelete(false)}
              onConfirm={() =>
                remove.mutate(undefined, {
                  onSuccess: () => {
                    toast.success(t('myReady.deleted', { title: message.title }));
                    onClose();
                  },
                  onError: () => toast.error(t('myReady.error')),
                })
              }
            />
          ) : (
            <Button variant="danger" className="self-start" onClick={() => setConfirmDelete(true)}>
              {t('myReady.delete')}
            </Button>
          ))}
      </div>
    </Dialog>
  );
}
