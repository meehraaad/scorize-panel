import { useQuery } from '@tanstack/react-query';
import { useState, type SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { ChoiceGroup } from '@/components/ui/Choices';
import { Chip } from '@/components/ui/Chip';
import { IconButton } from '@/components/ui/IconButton';
import { SectionCard } from '@/components/ui/SectionCard';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { TextAreaField } from '@/components/ui/TextField';
import { useFormat } from '@/lib/i18n/useFormat';
import {
  NOTE_ABOUTS,
  notebookQuery,
  useAddNote,
  useChangeNote,
  type Note,
  type NoteAbout,
} from '@/lib/notes/api';
import { toast } from '@/lib/toast';

/**
 * The customer's shared notebook (S61), the same in every panel: write a note about the person or
 * their contract, pin what everyone must see, and read who wrote what and when. Only the author
 * changes a note's text. Canvas "صفحه‌ی مشتری", board Side. Needs the `notes` namespace.
 */
export function Notebook({ url, name }: { url: string; name: string }) {
  const { t } = useTranslation('notes');
  const f = useFormat();
  const { data, isPending, isError } = useQuery(notebookQuery(url));
  return (
    <SectionCard
      id="notebook"
      variant="panel"
      title={t('title')}
      badge={
        data && data.length > 0 ? (
          <span className="text-sm text-text-2">{f.number(data.length)}</span>
        ) : undefined
      }
    >
      <Composer url={url} name={name} />
      {isPending ? (
        <SkeletonRows rows={2} />
      ) : isError ? (
        <p className="m-0 text-sm text-text-2">{t('error')}</p>
      ) : data.length === 0 ? (
        <p className="m-0 text-sm text-text-2">{t('empty')}</p>
      ) : (
        <ol aria-label={t('list')} className="m-0 flex list-none flex-col gap-2 p-0">
          {data.map((note) => (
            <NoteRow key={note.id} url={url} note={note} />
          ))}
        </ol>
      )}
    </SectionCard>
  );
}

function Composer({ url, name }: { url: string; name: string }) {
  const { t } = useTranslation('notes');
  const add = useAddNote(url);
  const [text, setText] = useState('');
  const [about, setAbout] = useState<NoteAbout>('customer');
  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!text.trim()) return;
    add.mutate(
      { text: text.trim(), about },
      {
        onSuccess: () => {
          setText('');
          toast.success(t('saved'));
        },
        onError: () => toast.error(t('error')),
      },
    );
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <TextAreaField
        label={t('new', { name })}
        placeholder={t('placeholder')}
        rows={2}
        maxLength={2000}
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
      {text.trim() && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <ChoiceGroup
            legend={t('about.legend')}
            hideLegend
            look="segmented"
            value={about}
            onChange={setAbout}
            options={NOTE_ABOUTS.map((value) => ({ value, label: t(`about.${value}`) }))}
          />
          <Button type="submit" disabled={add.isPending}>
            {t('save')}
          </Button>
        </div>
      )}
    </form>
  );
}

function NoteRow({ url, note }: { url: string; note: Note }) {
  const { t } = useTranslation('notes');
  const f = useFormat();
  const change = useChangeNote(url);
  const [draft, setDraft] = useState<string | null>(null);
  const who = note.imported
    ? t(`imported.${note.imported}`)
    : t('by', { author: note.author ?? t('removed'), role: t(`role.${note.role}`) });

  const save = (body: { text?: string; pinned?: boolean }, done?: () => void) =>
    change.mutate(
      { id: note.id, ...body },
      { onSuccess: () => done?.(), onError: () => toast.error(t('error')) },
    );

  return (
    <li
      className={`flex flex-col gap-2 rounded-2xl p-3.5 ${note.pinned ? 'bg-warn-tint' : 'bg-canvas'}`}
    >
      <div className="flex items-start gap-2">
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[13px] font-semibold">{who}</span>
          <time dateTime={note.created_at} className="text-xs text-text-2">
            {f.timeAgo(note.created_at)}
            {note.edited_at && ` · ${t('edited')}`}
          </time>
        </span>
        {note.about === 'contract' && (
          <Chip tone="info" small>
            {t('about.contract')}
          </Chip>
        )}
        <IconButton
          icon="pin"
          iconSize={16}
          tone={note.pinned ? 'default' : 'muted'}
          aria-label={t(note.pinned ? 'unpin' : 'pin')}
          aria-pressed={note.pinned}
          disabled={change.isPending}
          onClick={() => save({ pinned: !note.pinned })}
          className="-my-2 -me-2"
        />
      </div>
      {draft === null ? (
        <p className="m-0 text-sm leading-7 break-words whitespace-pre-wrap">{note.text}</p>
      ) : (
        <div className="flex flex-col gap-2">
          <TextAreaField
            label={t('editLabel')}
            rows={3}
            maxLength={2000}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            autoFocus
          />
          <div className="flex gap-2">
            <Button
              disabled={change.isPending || !draft.trim() || draft.trim() === note.text}
              onClick={() => save({ text: draft.trim() }, () => setDraft(null))}
            >
              {t('save')}
            </Button>
            <Button variant="outline" onClick={() => setDraft(null)}>
              {t('cancel')}
            </Button>
          </div>
        </div>
      )}
      {note.mine && draft === null && (
        <button
          type="button"
          onClick={() => setDraft(note.text)}
          className="inline-flex min-h-11 items-center self-start text-[13px] font-medium text-primary-text"
        >
          {t('edit')}
        </button>
      )}
    </li>
  );
}
