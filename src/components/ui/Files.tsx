import type { ChangeEvent, ReactNode } from 'react';
import { safeHref } from '@/lib/url';
import { buttonClass } from './buttonStyles';
import { Icon } from './Icon';
import { IconButton } from './IconButton';

/**
 * Drop zone for one file: a real <input type="file"> covers the field, so a click anywhere opens
 * the picker (camera and gallery on phones) and a dropped file lands on it. The caller checks the
 * file (see lib/files.ts) and shows its own error, linked with `errorId`.
 * `compact`: an outline "Attach a file" button instead of the zone (message composers); on phones
 * only its paperclip shows (the label stays for screen readers).
 */
export function FileDrop({
  id,
  accept,
  disabled = false,
  errorId,
  chooseLabel,
  hint,
  touchHint,
  compact = false,
  inputLabel,
  onFile,
}: {
  id: string;
  accept: readonly string[];
  disabled?: boolean;
  /** Id of the error text under the field, when there is one. */
  errorId?: string | null;
  /** "Choose a file". */
  chooseLabel: string;
  /** "or drop it here" (mouse) and its touch-screen wording. */
  hint?: string;
  touchHint?: string;
  compact?: boolean;
  /** The picker's full name when the visible label is short ("Upload" → "Upload Passport"). */
  inputLabel?: string;
  onFile: (file: File | undefined) => void;
}) {
  const input = (
    <input
      id={id}
      type="file"
      accept={accept.join(',')}
      disabled={disabled}
      aria-label={inputLabel}
      aria-invalid={errorId ? true : undefined}
      aria-describedby={errorId ?? undefined}
      onChange={(event: ChangeEvent<HTMLInputElement>) => {
        onFile(event.target.files?.[0]);
        event.target.value = '';
      }}
      className="absolute inset-0 cursor-pointer opacity-0 disabled:cursor-not-allowed"
    />
  );

  if (compact)
    return (
      <span
        className={buttonClass(
          'outline',
          'relative px-4 has-[input:disabled]:opacity-50 has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-focus max-lg:size-11 max-lg:px-0',
        )}
      >
        <Icon name="paperclip" size={18} />
        <label htmlFor={id} className="max-lg:sr-only">
          {chooseLabel}
        </label>
        {input}
      </span>
    );

  return (
    <div className="relative flex min-h-24 flex-wrap items-center justify-center gap-3 rounded-[18px] border-[1.5px] border-dashed border-line-3 bg-canvas p-4 text-center has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-focus lg:min-h-[84px]">
      <Icon name="upload" className="text-primary-text" />
      <span className="text-[15px]">
        <span className="font-semibold text-primary-text">{chooseLabel}</span>{' '}
        {hint && <span className="text-text-2 pointer-coarse:hidden">{hint}</span>}
        {touchHint && <span className="hidden text-text-2 pointer-coarse:inline">{touchHint}</span>}
      </span>
      {input}
    </div>
  );
}

/** A file picked and waiting to be sent: its type, name, a line about it, and a remove button. */
export function PickedFile({
  ext,
  name,
  meta,
  removeLabel,
  disabled = false,
  onRemove,
}: {
  ext: string;
  name: string;
  meta: ReactNode;
  removeLabel: string;
  disabled?: boolean;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-[18px] bg-tint py-3 ps-4 pe-2">
      <span className="flex size-10 flex-none items-center justify-center rounded-xl bg-surface text-[11px] font-bold text-primary-text">
        {ext}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <bdi className="truncate text-[15px] font-semibold">{name}</bdi>
        <span className="text-[13px] text-text-2">{meta}</span>
      </span>
      <IconButton
        icon="close"
        iconSize={18}
        aria-label={removeLabel}
        disabled={disabled}
        onClick={onRemove}
        className="hover:bg-surface"
      />
    </div>
  );
}

/**
 * A stored file: type badge, name (opens the file), a line under it, and actions at the end
 * (download, delete). `highlight` marks files from the team.
 */
export function FileTile({
  ext,
  name,
  href,
  meta,
  highlight = false,
  actions,
  children,
}: {
  ext: string;
  name: string;
  href: string;
  meta: ReactNode;
  highlight?: boolean;
  actions?: ReactNode;
  /** Below the row: an error about this file. */
  children?: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-[18px] py-3 ps-3 pe-2 shadow-[inset_0_0_0_1px_var(--hair)]">
      <div className="flex min-w-0 items-center gap-3">
        <span
          aria-hidden="true"
          className={`flex size-11 flex-none items-center justify-center rounded-xl text-[11px] font-bold ${
            highlight ? 'bg-tint text-primary-text' : 'bg-neutral-tint text-neutral'
          }`}
        >
          {ext}
        </span>
        <a
          href={safeHref(href)}
          target="_blank"
          rel="noopener"
          className="flex min-w-0 flex-1 flex-col gap-0.5 text-text"
        >
          <span className="truncate text-[15px] font-semibold">{name}</span>
          <span className={`text-[13px] ${highlight ? 'text-primary-text' : 'text-text-2'}`}>
            {meta}
          </span>
        </a>
        {actions}
      </div>
      {children}
    </div>
  );
}
