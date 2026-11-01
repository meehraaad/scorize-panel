import { useLayoutEffect, useRef, type ReactNode, type SubmitEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { FileDrop, PickedFile } from '@/components/ui/Files';
import { Icon } from '@/components/ui/Icon';

export interface ComposerChoice {
  value: number;
  label: string;
  /** `warn`: a choice with consequences (very urgent). */
  tone?: 'warn' | undefined;
}

interface ComposerProps {
  /** Prefix of the ids inside (textarea, radios, file input). */
  id: string;
  /** The textarea's name for screen readers ("Message"). */
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  /** Priority radios ("Low … Very urgent"); left out where the viewer doesn't pick one (staff). */
  priority?:
    | {
        label: string;
        options: readonly ComposerChoice[];
        value: number;
        onChange: (value: number) => void;
      }
    | undefined;
  /** A box under the priorities that must be accepted before sending (very urgent rules). */
  confirm?:
    | { text: ReactNode; label: string; checked: boolean; onChange: (checked: boolean) => void }
    | null
    | undefined;
  /** Attaching a file; left out where messages are text only (the assistant). */
  attach?: {
    /** "Attach a file". */
    label: string;
    accept: readonly string[];
    /** The picked file, ready to show. */
    file: { ext: string; name: string; meta: ReactNode } | null;
    removeLabel: string;
    /** Why the picked file can't be sent. */
    error?: string | null | undefined;
    onFile: (file: File | undefined) => void;
    onRemove: () => void;
  };
  sendLabel: string;
  sending: boolean;
  /** Send stays off (nothing typed, rules not accepted). */
  canSend: boolean;
  onSubmit: () => void;
  /**
   * `chat`: an AI chat's bar at every size: one line that grows with the text, send inside it,
   * Enter sends and Shift+Enter starts a new line. Text only (no priority, confirm or attach).
   */
  variant?: 'ticket' | 'chat';
  /** Under the chat bar, from lg ("Enter sends · Shift+Enter: new line"). */
  hint?: string | undefined;
}

const CHOICE = {
  off: 'text-text-2 shadow-[inset_0_0_0_1px_var(--line-2)] hover:text-text',
  on: 'bg-tint text-primary-text shadow-[inset_0_0_0_1.5px_var(--primary)]',
  warn: 'bg-warn-tint text-warn shadow-[inset_0_0_0_1.5px_var(--warn)]',
} as const;

const choiceLook = (checked: boolean, tone: ComposerChoice['tone']) =>
  checked ? CHOICE[tone === 'warn' ? 'warn' : 'on'] : CHOICE.off;

/** Up to this tall, then the textarea scrolls. */
const MAX_TEXT_HEIGHT = 168;

/**
 * Writing a message: text, priority, a file, send. Every word comes from the caller.
 * Phones: a chat bar (file · text that grows · send) under the priority row. From lg: a large
 * text box, then priority, then file and send.
 */
export function Composer({
  id,
  label,
  placeholder,
  value,
  onChange,
  priority,
  confirm,
  attach,
  sendLabel,
  sending,
  canSend,
  onSubmit,
  variant = 'ticket',
  hint,
}: ComposerProps) {
  const fileError = attach?.error ? `${id}-file-error` : null;
  const text = useRef<HTMLTextAreaElement>(null);

  // Grow with the text (a chat bar starts one line tall).
  useLayoutEffect(() => {
    const element = text.current;
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${String(Math.min(element.scrollHeight, MAX_TEXT_HEIGHT))}px`;
  }, [value]);

  const submit = (event: SubmitEvent) => {
    event.preventDefault();
    if (canSend && !sending) onSubmit();
  };

  if (variant === 'chat')
    return (
      <form onSubmit={submit} className="flex-none px-3 pt-2 pb-3 lg:px-6 lg:pb-4">
        <div className="mx-auto flex w-full max-w-[780px] items-end gap-2 rounded-[26px] border border-hair bg-surface p-1.5 ps-4 shadow-panel has-[textarea:focus-visible]:outline-2 has-[textarea:focus-visible]:outline-focus">
          <label htmlFor={`${id}-text`} className="sr-only">
            {label}
          </label>
          <textarea
            ref={text}
            id={`${id}-text`}
            rows={1}
            value={value}
            enterKeyHint="send"
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
              event.preventDefault();
              if (canSend && !sending) onSubmit();
            }}
            placeholder={placeholder}
            className="min-h-11 flex-1 resize-none bg-transparent py-2 text-base leading-7 text-text outline-0 placeholder:text-text-2"
          />
          <Button
            type="submit"
            disabled={!canSend || sending}
            aria-label={sendLabel}
            className="size-11 flex-none px-0!"
          >
            <Icon name="send" size={18} />
          </Button>
        </div>
        {hint && <p className="m-0 mt-2 text-center text-xs text-text-2 max-lg:hidden">{hint}</p>}
      </form>
    );

  return (
    <form
      onSubmit={submit}
      className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-end gap-2 bg-surface px-3 py-3 shadow-[inset_0_1px_0_var(--hair)] lg:gap-x-2.5 lg:gap-y-3.5 lg:px-7 lg:pt-5 lg:pb-6"
    >
      {confirm && (
        <div className="col-span-3 flex flex-col gap-2.5 rounded-2xl bg-warn-tint px-4 py-3.5 lg:order-3">
          <p className="m-0 text-[13px] leading-[1.9] text-text">{confirm.text}</p>
          <label className="inline-flex min-h-11 cursor-pointer items-center gap-2.5 self-start text-sm font-semibold">
            <input
              type="checkbox"
              checked={confirm.checked}
              onChange={(event) => confirm.onChange(event.target.checked)}
              className="m-0 size-5 accent-primary"
            />
            {confirm.label}
          </label>
        </div>
      )}

      {attach?.file && (
        <div className="col-span-3 lg:order-4">
          <PickedFile
            ext={attach.file.ext}
            name={attach.file.name}
            meta={attach.file.meta}
            removeLabel={attach.removeLabel}
            disabled={sending}
            onRemove={attach.onRemove}
          />
        </div>
      )}
      {attach?.error && (
        <p
          id={fileError ?? undefined}
          className="col-span-3 m-0 text-sm leading-6 text-danger lg:order-4"
        >
          {attach.error}
        </p>
      )}

      {priority && (
        <div
          role="radiogroup"
          aria-labelledby={`${id}-priority`}
          className="col-span-3 -mx-3 flex [scrollbar-width:none] items-center gap-2.5 overflow-x-auto px-3 lg:order-2 lg:mx-0 lg:flex-wrap lg:px-0"
        >
          <span id={`${id}-priority`} className="flex-none text-[13px] text-text-2">
            {priority.label}
          </span>
          <span className="flex flex-none gap-1.5 lg:flex-wrap">
            {priority.options.map((option) => {
              const checked = option.value === priority.value;
              const look = choiceLook(checked, option.tone);
              return (
                <label
                  key={option.value}
                  className={`inline-flex h-11 flex-none cursor-pointer items-center rounded-full px-3 text-[13px] font-semibold whitespace-nowrap has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus lg:px-3.5 ${look}`}
                >
                  <input
                    type="radio"
                    name={`${id}-priority`}
                    value={option.value}
                    checked={checked}
                    onChange={() => priority.onChange(option.value)}
                    className="sr-only"
                  />
                  {option.label}
                </label>
              );
            })}
          </span>
        </div>
      )}

      {attach ? (
        <div className="lg:order-5">
          <FileDrop
            id={`${id}-file`}
            compact
            accept={attach.accept}
            disabled={sending}
            errorId={fileError}
            chooseLabel={attach.label}
            onFile={attach.onFile}
          />
        </div>
      ) : (
        // Keeps the phone bar's grid: text in the middle column, send at the end.
        <span aria-hidden="true" className="lg:hidden" />
      )}
      <label htmlFor={`${id}-text`} className="sr-only">
        {label}
      </label>
      <textarea
        ref={text}
        id={`${id}-text`}
        rows={1}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="min-h-11 w-full resize-none rounded-[22px] bg-canvas px-4 py-2 text-base leading-7 text-text shadow-[inset_0_0_0_1px_var(--line-2)] outline-0 placeholder:text-text-2 focus-visible:shadow-[inset_0_0_0_2px_var(--focus)] lg:order-1 lg:col-span-3 lg:min-h-[124px] lg:rounded-[18px] lg:py-3.5 lg:leading-[1.9]"
      />
      <Button
        type="submit"
        disabled={!canSend || sending}
        className="max-lg:size-11 max-lg:px-0 lg:order-5 lg:col-start-3"
      >
        <Icon name="send" size={18} className="lg:hidden" />
        <span className="max-lg:sr-only">{sendLabel}</span>
      </Button>
    </form>
  );
}
