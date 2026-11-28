import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { SelectField } from '@/components/ui/Choices';
import { ConfirmIconButton } from '@/components/ui/ConfirmIconButton';
import { DatePicker } from '@/components/ui/DatePicker';
import { Dialog } from '@/components/ui/Dialog';
import { FileDrop, FileTile } from '@/components/ui/Files';
import { IconButton } from '@/components/ui/IconButton';
import { InlineConfirm } from '@/components/ui/InlineConfirm';
import { Notice } from '@/components/ui/Notice';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { TextAreaField, TextField } from '@/components/ui/TextField';
import { ApiError } from '@/lib/api/client';
import { fieldErrors } from '@/lib/api/fieldErrors';
import { toValue } from '@/lib/calendar';
import { useFormat } from '@/lib/i18n/useFormat';
import { toast } from '@/lib/toast';
import { uploadFile } from '@/lib/upload';
import { useUser } from '@/lib/auth/session';
import { MARKETING_KEY } from '../api';
import {
  cardPath,
  cardQuery,
  useArchiveCard,
  useEditCard,
  useMoveCard,
  useRemoveCardFile,
  useReturnCard,
  type BoardData,
  type CardDetail,
  type MoveRefusal,
  ownerChoices,
  type StageNeed,
} from '../boardApi';

const ACCEPT = ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx'] as const;
const NONE = 'none';

/**
 * A card's details (a side panel): move it on (or say what the next stage still needs), its fields,
 * checklist and final file, sending back (the manager), archiving, and its history.
 */
export default function CardDialog({
  id,
  board,
  onClose,
}: {
  id: number;
  board: BoardData;
  onClose: () => void;
}) {
  const { t } = useTranslation('marketing');
  const { data } = useQuery(cardQuery(id));
  return data ? (
    <CardForm key={data.id} card={data} board={board} onClose={onClose} />
  ) : (
    <Dialog open onClose={onClose} title={t('card.title')} closeLabel={t('card.close')}>
      <SkeletonRows rows={6} />
    </Dialog>
  );
}

function CardForm({
  card,
  board,
  onClose,
}: {
  card: CardDetail;
  board: BoardData;
  onClose: () => void;
}) {
  const { t } = useTranslation('marketing');
  const f = useFormat();
  const user = useUser();
  const client = useQueryClient();
  const edit = useEditCard();
  const move = useMoveCard();
  const sendBack = useReturnCard();
  const archive = useArchiveCard();
  const removeFile = useRemoveCardFile();
  const [fields, setFields] = useState({
    title: card.title,
    description: card.description,
    type: card.type === null ? NONE : String(card.type),
    owner: card.owner === null ? NONE : String(card.owner.id),
    campaign: card.campaign === null ? NONE : String(card.campaign.id),
    publish_at: card.publish_at ? toValue(new Date(card.publish_at), true) : '',
    caption: card.caption,
    link: card.link,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [newItem, setNewItem] = useState('');
  const [other, setOther] = useState('');
  const [backTo, setBackTo] = useState('');
  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState('');
  const [archiving, setArchiving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const stage = board.stages.find((item) => item.id === card.stage);
  const next = board.stages.find((item) => item.id === card.next_stage);
  const locked = Boolean(stage?.manager_only) && !board.can_manage;
  const needs = (list: readonly StageNeed[]) => f.list(list.map((need) => t(`need.${need}`)));
  const set = (name: keyof typeof fields) => (value: string) =>
    setFields((current) => ({ ...current, [name]: value }));
  const idOf = (value: string) => (value === NONE ? null : Number(value));
  const earlier = board.stages.filter((item) => item.order < (stage?.order ?? 0));

  const save = () =>
    edit.mutate(
      {
        id: card.id,
        title: fields.title.trim(),
        description: fields.description,
        type: idOf(fields.type),
        owner: idOf(fields.owner),
        campaign: idOf(fields.campaign),
        publish_at: fields.publish_at ? new Date(fields.publish_at).toISOString() : null,
        caption: fields.caption,
        link: fields.link.trim(),
      },
      {
        onSuccess: () => {
          setErrors({});
          toast.success(t('card.saved'));
        },
        onError: (error) => {
          setErrors(fieldErrors(error));
          if (Object.keys(fieldErrors(error)).length === 0) toast.error(t('card.error'));
        },
      },
    );

  const setItems = (items: CardDetail['items']) =>
    edit.mutate({ id: card.id, checklist: items }, { onError: () => toast.error(t('card.error')) });

  const moveTo = (to: number) =>
    move.mutate(
      { id: card.id, stage: to },
      {
        onSuccess: () => {
          setOther('');
          setBackTo('');
          toast.success(
            t('card.moved', { stage: board.stages.find((item) => item.id === to)?.name ?? '' }),
          );
        },
        onError: (error) => {
          const refusal =
            error instanceof ApiError && error.status === 409 ? (error.body as MoveRefusal) : null;
          toast.error(
            refusal?.code === 'needs'
              ? t('board.needsList', { list: needs(refusal.missing) })
              : (refusal?.detail ?? t('card.error')),
          );
        },
      },
    );

  const upload = async (file: File) => {
    const body = new FormData();
    body.append('file', file);
    setUploading(true);
    try {
      const saved = await uploadFile<CardDetail>(cardPath(card.id, 'file/'), body, file, {
        done: t('card.fileSaved'),
      });
      client.setQueryData(cardQuery(card.id).queryKey, saved);
      void client.invalidateQueries({ queryKey: MARKETING_KEY });
    } catch {
      // The upload toast already says what went wrong.
    } finally {
      setUploading(false);
    }
  };

  const busy = edit.isPending || move.isPending || sendBack.isPending;

  return (
    <Dialog
      open
      onClose={onClose}
      title={card.title}
      subtitle={stage?.name}
      closeLabel={t('card.close')}
      footer={
        <>
          <Button disabled={busy || !fields.title.trim()} onClick={save}>
            {t('card.save')}
          </Button>
          <Button variant="outline" onClick={onClose}>
            {t('card.close')}
          </Button>
        </>
      }
    >
      {card.returned && (
        <Notice tone="warn">
          {t('card.returnedNote', {
            note: card.events.find((event) => event.kind === 'returned')?.note ?? '',
          })}
        </Notice>
      )}
      <section
        aria-labelledby="card-step"
        className="flex flex-col gap-3 rounded-2xl bg-canvas p-4"
      >
        <h3 id="card-step" className="m-0 text-sm font-semibold text-text-2">
          {t('card.step')}
        </h3>
        <p className="m-0 text-[15px]">
          {!card.step
            ? t('card.noStep')
            : card.step.done
              ? t('card.stepDoneOf', { name: card.step.owner?.name ?? '' })
              : t('card.stepOf', {
                  name: card.step.owner?.name ?? t('card.noOwner'),
                  date: f.dateShort(card.step.due),
                })}
        </p>
        {locked && stage ? (
          <Notice tone="info">{t('card.managerOnly', { stage: stage.name })}</Notice>
        ) : next ? (
          <>
            {card.missing.length > 0 && (
              <Notice tone="warn">{t('board.needsList', { list: needs(card.missing) })}</Notice>
            )}
            <Button
              disabled={busy || card.missing.length > 0}
              onClick={() => moveTo(next.id)}
              className="self-start"
            >
              {t('card.next', { stage: next.name })}
            </Button>
          </>
        ) : (
          <p className="m-0 text-sm text-text-2">{t('card.last')}</p>
        )}
        {!locked && (
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-0 flex-1">
              <SelectField
                label={t('card.moveOther')}
                value={other}
                onChange={setOther}
                options={[
                  { value: '', label: t('card.pickStage') },
                  ...board.stages
                    .filter((item) => item.id !== card.stage)
                    .map((item) => ({ value: String(item.id), label: item.name })),
                ]}
              />
            </div>
            <Button
              variant="outline"
              disabled={busy || !other}
              onClick={() => moveTo(Number(other))}
            >
              {t('card.move')}
            </Button>
          </div>
        )}
      </section>

      {board.can_manage && stage?.manager_only && earlier.length > 0 && (
        <section aria-labelledby="card-back" className="flex flex-col gap-3">
          <h3 id="card-back" className="m-0 text-base font-bold">
            {t('card.sendBack')}
          </h3>
          <SelectField
            label={t('card.sendBackTo')}
            value={backTo || String(earlier[earlier.length - 1]?.id ?? '')}
            onChange={setBackTo}
            options={earlier.map((item) => ({ value: String(item.id), label: item.name }))}
          />
          <TextAreaField
            label={t('card.note')}
            rows={3}
            value={note}
            error={noteError || undefined}
            onChange={(event) => setNote(event.target.value)}
          />
          <Button
            variant="outline"
            className="self-start"
            disabled={busy}
            onClick={() => {
              if (!note.trim()) {
                setNoteError(t('card.noteRequired'));
                return;
              }
              const to = Number(backTo || earlier[earlier.length - 1]?.id);
              sendBack.mutate(
                { id: card.id, stage: to, note: note.trim() },
                {
                  onSuccess: () => {
                    setNote('');
                    setNoteError('');
                    setBackTo('');
                    toast.success(t('card.sentBack'));
                  },
                  onError: () => toast.error(t('card.error')),
                },
              );
            }}
          >
            {t('card.sendBack')}
          </Button>
        </section>
      )}

      <TextField
        label={t('card.title')}
        value={fields.title}
        maxLength={160}
        error={errors.title}
        onChange={(event) => set('title')(event.target.value)}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label={t('card.type')}
          value={fields.type}
          onChange={set('type')}
          options={[
            { value: NONE, label: t('card.noType') },
            ...board.types
              .filter((item) => item.is_active || String(item.id) === fields.type)
              .map((item) => ({ value: String(item.id), label: item.name })),
          ]}
        />
        <SelectField
          label={t('card.owner')}
          value={fields.owner}
          onChange={set('owner')}
          options={[
            { value: NONE, label: t('card.noOwner') },
            ...ownerChoices(board.people, user, card.owner?.id ?? null).map((person) => ({
              value: String(person.id),
              label: person.name,
            })),
          ]}
        />
      </div>
      <DatePicker
        label={t('card.publishAt')}
        time
        clearable
        value={fields.publish_at}
        onChange={set('publish_at')}
        error={errors.publish_at}
      />
      <SelectField
        label={t('card.campaign')}
        value={fields.campaign}
        onChange={set('campaign')}
        options={[
          { value: NONE, label: t('card.noCampaign') },
          ...board.campaigns.map((item) => ({ value: String(item.id), label: item.title })),
          ...(card.campaign && !board.campaigns.some((item) => item.id === card.campaign?.id)
            ? [{ value: String(card.campaign.id), label: card.campaign.title }]
            : []),
        ]}
      />
      <TextAreaField
        label={t('card.description')}
        rows={3}
        value={fields.description}
        onChange={(event) => set('description')(event.target.value)}
      />

      <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
        <legend className="mb-2 text-[15px] font-medium">{t('card.checklist')}</legend>
        {card.items.map((item, index) => (
          <div key={`${item.label}-${String(index)}`} className="flex items-center gap-2">
            <label className="flex min-h-11 flex-1 cursor-pointer items-center gap-3 text-[15px]">
              <input
                type="checkbox"
                checked={item.done}
                disabled={edit.isPending}
                onChange={(event) =>
                  setItems(
                    card.items.map((other, at) =>
                      at === index ? { ...other, done: event.target.checked } : other,
                    ),
                  )
                }
                className="size-5 accent-primary"
              />
              <span className={item.done ? 'text-text-2 line-through' : ''}>{item.label}</span>
            </label>
            <IconButton
              icon="close"
              iconSize={16}
              aria-label={t('card.removeItem', { label: item.label })}
              disabled={edit.isPending}
              onClick={() => setItems(card.items.filter((_, at) => at !== index))}
              className="text-text-2"
            />
          </div>
        ))}
        <div className="flex items-end gap-2">
          <div className="min-w-0 flex-1">
            <TextField
              label={t('card.newItem')}
              value={newItem}
              maxLength={120}
              onChange={(event) => setNewItem(event.target.value)}
            />
          </div>
          <Button
            variant="outline"
            disabled={edit.isPending || !newItem.trim()}
            onClick={() => {
              setItems([...card.items, { label: newItem.trim(), done: false }]);
              setNewItem('');
            }}
          >
            {t('card.addItem')}
          </Button>
        </div>
      </fieldset>

      <TextAreaField
        label={t('card.caption')}
        rows={4}
        value={fields.caption}
        onChange={(event) => set('caption')(event.target.value)}
      />
      <TextField
        label={t('card.link')}
        hint={t('card.linkHint')}
        type="url"
        dir="ltr"
        value={fields.link}
        error={errors.link}
        onChange={(event) => set('link')(event.target.value)}
      />

      <section aria-labelledby="card-file" className="flex flex-col gap-2">
        <h3 id="card-file" className="m-0 text-[15px] font-medium">
          {t('card.file')}
        </h3>
        {card.file ? (
          <FileTile
            ext={card.file.split('.').pop() ?? ''}
            name={card.file.split('/').pop() ?? ''}
            href={card.file}
            meta={t('card.openFile')}
            actions={
              <ConfirmIconButton
                aria-label={t('card.removeFile')}
                disabled={removeFile.isPending}
                onConfirm={() =>
                  removeFile.mutate(card.id, { onError: () => toast.error(t('card.error')) })
                }
              />
            }
          />
        ) : (
          <FileDrop
            id={`card-file-${String(card.id)}`}
            accept={ACCEPT}
            disabled={uploading}
            chooseLabel={t('card.chooseFile')}
            hint={t('card.dropFile')}
            touchHint={t('card.fileHint')}
            inputLabel={t('card.file')}
            onFile={(file) => file && void upload(file)}
          />
        )}
      </section>

      <section aria-labelledby="card-history" className="flex flex-col gap-2">
        <h3 id="card-history" className="m-0 text-[15px] font-medium">
          {t('card.history')}
        </h3>
        <ol className="m-0 flex list-none flex-col gap-2 p-0">
          {card.events.map((event) => (
            <li key={event.id} className="flex flex-col gap-0.5 text-sm">
              <span>
                {t(`card.event.${event.kind}`, { from: event.from ?? '', to: event.to ?? '' })}
              </span>
              {event.note && (
                <span className="text-text-2">{t('card.quote', { note: event.note })}</span>
              )}
              <span className="text-xs text-text-2">
                {t('card.eventBy', { name: event.by ?? '', when: f.dateTime(event.at) })}
              </span>
            </li>
          ))}
        </ol>
      </section>

      {archiving ? (
        <InlineConfirm
          message={t('card.archiveConfirm', { title: card.title })}
          confirmLabel={t('card.archive')}
          cancelLabel={t('card.cancel')}
          pending={archive.isPending}
          onCancel={() => setArchiving(false)}
          onConfirm={() =>
            archive.mutate(card.id, {
              onSuccess: () => {
                toast.success(t('card.archived'));
                onClose();
              },
              onError: () => toast.error(t('card.error')),
            })
          }
        />
      ) : (
        <Button
          variant="outline"
          className="self-start text-danger"
          onClick={() => setArchiving(true)}
        >
          {t('card.archive')}
        </Button>
      )}
    </Dialog>
  );
}
