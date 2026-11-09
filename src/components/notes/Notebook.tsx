import { useQuery } from '@tanstack/react-query';
import { useId, useState, type KeyboardEvent, type SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Icon, type IconName } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { SectionCard } from '@/components/ui/SectionCard';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { TextAreaField } from '@/components/ui/TextField';
import { useFormat } from '@/lib/i18n/useFormat';
import {
  notebookQuery,
  useAddNote,
  useChangeNote,
  type Note,
  type NoteAbout,
} from '@/lib/notes/api';
import { initialOf } from '@/lib/text';
import { toast } from '@/lib/toast';

/** The writer's avatar colour by role. */
const AVATAR: Record<Note['role'], string> = {
  sales: 'bg-warn-tint text-warn',
  supervisor: 'bg-info-tint text-info',
  manager: 'bg-hero text-on-hero',
  staff: 'bg-neutral-tint text-neutral',
};

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
      subtitle={t('subtitle')}
      badge={
        data && data.length > 0 ? (
          <span className="text-sm text-text-2">{f.number(data.length)}</span>
        ) : undefined
      }
    >
      {isPending ? (
        <SkeletonRows rows={2} />
      ) : isError ? (
        <p className="m-0 text-sm text-text-2">{t('error')}</p>
      ) : (
        <>
          {data
            .filter((note) => note.pinned)
            .slice(0, 1)
            .map((note) => (
              <ol key={note.id} aria-label={t('pinned')} className="m-0 list-none p-0">
                <NoteRow url={url} note={note} />
              </ol>
            ))}
          <Composer url={url} name={name} />
          {data.length === 0 ? (
            <NotesEmpty />
          ) : (
            <ol aria-label={t('list')} className="m-0 flex list-none flex-col p-0">
              {data
                .filter((note, index) => !(note.pinned && index === 0))
                .map((note) => (
                  <NoteRow key={note.id} url={url} note={note} />
                ))}
            </ol>
          )}
        </>
      )}
    </SectionCard>
  );
}

const MAX_NOTE = 2000;

/** A pill that turns on and off inside the composer's toolbar (pin, about the contract). */
function ToggleChip({
  on,
  icon,
  onToggle,
  children,
}: {
  on: boolean;
  icon: IconName;
  onToggle: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onToggle}
      className={`relative inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium transition-colors before:absolute before:inset-x-0 before:-inset-y-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)] ${
        on
          ? 'bg-tint text-primary-text shadow-[inset_0_0_0_1px_var(--primary)]'
          : 'text-text-2 hover:bg-track hover:text-text'
      }`}
    >
      <Icon name={icon} size={15} />
      {children}
    </button>
  );
}

function Composer({ url, name }: { url: string; name: string }) {
  const { t } = useTranslation('notes');
  const f = useFormat();
  const add = useAddNote(url);
  const inputId = useId();
  const [text, setText] = useState('');
  const [about, setAbout] = useState<NoteAbout>('customer');
  const [pinned, setPinned] = useState(false);
  const ready = text.trim().length > 0 && !add.isPending;

  const send = () => {
    if (!ready) return;
    add.mutate(
      { text: text.trim(), about, pinned },
      {
        onSuccess: () => {
          setText('');
          setPinned(false);
          setAbout('customer');
          toast.success(t('saved'));
        },
        onError: () => toast.error(t('error')),
      },
    );
  };
  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    send();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      send();
    }
  };

  return (
    <form
      onSubmit={submit}
      className="flex flex-col rounded-2xl bg-surface shadow-[inset_0_0_0_1px_var(--line-2)] transition-shadow focus-within:shadow-[inset_0_0_0_2px_var(--focus)] hover:shadow-[inset_0_0_0_1px_var(--line-3)] hover:focus-within:shadow-[inset_0_0_0_2px_var(--focus)]"
    >
      <label htmlFor={inputId} className="sr-only">
        {t('new', { name })}
      </label>
      <textarea
        id={inputId}
        rows={2}
        maxLength={MAX_NOTE}
        value={text}
        placeholder={t('placeholder')}
        aria-keyshortcuts="Control+Enter Meta+Enter"
        onChange={(event) => setText(event.target.value)}
        onKeyDown={onKeyDown}
        className="block max-h-64 min-h-20 w-full resize-none bg-transparent px-4 pt-3.5 pb-1 text-[15px] leading-7 text-text outline-none [field-sizing:content] placeholder:text-text-3"
      />
      <div className="flex flex-wrap items-center gap-1 px-2 pt-1 pb-2">
        <ToggleChip on={pinned} icon="pin" onToggle={() => setPinned((value) => !value)}>
          {t('pinIt')}
        </ToggleChip>
        <ToggleChip
          on={about === 'contract'}
          icon="document"
          onToggle={() => setAbout((value) => (value === 'contract' ? 'customer' : 'contract'))}
        >
          {t('aboutContract')}
        </ToggleChip>
        <span className="ms-auto flex items-center gap-3">
          {text.length > MAX_NOTE * 0.8 && (
            <span className="text-xs text-text-2 tabular-nums">
              {f.number(MAX_NOTE - text.length)}
            </span>
          )}
          <Button
            type="submit"
            disabled={!ready}
            aria-label={t('add')}
            title={t('add')}
            className="relative size-10 px-0 before:absolute before:-inset-0.5 disabled:bg-track disabled:text-text-2 disabled:opacity-100"
          >
            <Icon name="send" size={18} />
          </Button>
        </span>
      </div>
    </form>
  );
}

function NotesEmpty() {
  const { t } = useTranslation('notes');
  return (
    <div className="flex items-center gap-3 rounded-2xl px-1 py-2">
      <span
        aria-hidden="true"
        className="flex size-10 flex-none items-center justify-center rounded-xl bg-tint text-primary-text"
      >
        <Icon name="pen" size={18} />
      </span>
      <span className="flex flex-col">
        <span className="text-sm font-semibold">{t('empty')}</span>
        <span className="text-[13px] leading-6 text-text-2">{t('emptyHint')}</span>
      </span>
    </div>
  );
}

function NoteRow({ url, note }: { url: string; note: Note }) {
  const { t } = useTranslation('notes');
  const f = useFormat();
  const change = useChangeNote(url);
  const [draft, setDraft] = useState<string | null>(null);
  const author = note.imported ? t(`imported.${note.imported}`) : (note.author ?? t('removed'));
  const role = note.imported ? null : t(`role.${note.role}`);

  const save = (body: { text?: string; pinned?: boolean }, done?: () => void) =>
    change.mutate(
      { id: note.id, ...body },
      { onSuccess: () => done?.(), onError: () => toast.error(t('error')) },
    );

  return (
    <li
      className={`flex gap-3 ${
        note.pinned
          ? 'rounded-2xl bg-tint p-3.5'
          : 'py-3.5 shadow-[inset_0_1px_0_var(--hair)] first:shadow-none'
      }`}
    >
      {!note.pinned && (
        <span
          aria-hidden="true"
          className={`flex size-9 flex-none items-center justify-center rounded-full text-sm font-bold ${
            note.imported ? 'bg-neutral-tint text-neutral' : AVATAR[note.role]
          }`}
        >
          {note.imported ? <Icon name="clock" size={15} /> : initialOf(author)}
        </span>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-start gap-2">
          <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-1.5">
            <span className="text-sm font-bold">{author}</span>
            <span className="text-xs text-text-2">
              {role && `${role} · `}
              <time dateTime={note.created_at}>{f.timeAgo(note.created_at)}</time>
              {note.edited_at && ` · ${t('edited')}`}
            </span>
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
            className="-my-2.5 -me-2"
          />
        </div>
        {draft === null ? (
          <p
            className={`m-0 text-sm leading-7 break-words whitespace-pre-wrap ${
              note.pinned ? 'font-semibold' : 'text-neutral'
            }`}
          >
            {note.text}
          </p>
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
      </div>
    </li>
  );
}
