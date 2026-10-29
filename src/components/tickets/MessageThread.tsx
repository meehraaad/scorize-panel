import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { Chip, type ChipTone } from '@/components/ui/Chip';
import { Icon } from '@/components/ui/Icon';
import { safeHref } from '@/lib/url';

/** Within this many pixels of the end counts as "at the newest message". */
const NEAR_END = 32;

/**
 * A conversation: an ordered list of MessageBubble and DaySeparator items, with an optional
 * "show earlier messages" button above it. Text comes in ready (no dictionary of its own).
 *
 * It is its own scroll box (fill a parent of fixed height, or cap it with `className`), kept at the
 * newest message: on open, when a message arrives (`lastKey` changes) and when the box shrinks
 * (the composer grows) while the reader was at the end. Loading earlier messages (`firstKey`
 * changes) keeps the reader's place.
 */
export function MessageThread({
  label,
  earlier,
  firstKey,
  lastKey,
  className = '',
  children,
}: {
  /** Names the list for screen readers ("Messages"). */
  label: string;
  earlier?: { label: string; pending: boolean; onClick: () => void } | null | undefined;
  /** Ids of the oldest and newest message shown. */
  firstKey: string | number | undefined;
  lastKey: string | number | undefined;
  /** Size of the scroll box (it already fills a flex column). */
  className?: string;
  children: ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  const atEnd = useRef(true);
  const last = useRef<{ first: typeof firstKey; last: typeof lastKey; height: number } | null>(
    null,
  );

  useLayoutEffect(() => {
    const element = box.current;
    if (!element) return;
    const before = last.current;
    if (before && before.last === lastKey && before.first !== firstKey)
      // Earlier messages were added above: stay on the same message.
      element.scrollTop += element.scrollHeight - before.height;
    else if (!before || before.last !== lastKey) element.scrollTop = element.scrollHeight;
    last.current = { first: firstKey, last: lastKey, height: element.scrollHeight };
  }, [firstKey, lastKey]);

  useEffect(() => {
    const element = box.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      if (atEnd.current) element.scrollTop = element.scrollHeight;
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={box}
      onScroll={(event) => {
        const element = event.currentTarget;
        atEnd.current = element.scrollHeight - element.scrollTop - element.clientHeight < NEAR_END;
      }}
      className={`flex min-h-0 flex-1 flex-col gap-[18px] overflow-y-auto overscroll-contain ${className}`}
    >
      {earlier && (
        <button
          type="button"
          disabled={earlier.pending}
          onClick={earlier.onClick}
          className="h-11 self-center rounded-full bg-canvas px-4 text-[13px] font-medium text-text-2 hover:text-text disabled:opacity-50"
        >
          {earlier.label}
        </button>
      )}
      <ol aria-label={label} className="m-0 flex list-none flex-col gap-[18px] p-0">
        {children}
      </ol>
    </div>
  );
}

/** "Monday 28 Mehr" between the messages of two days. */
export function DaySeparator({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-center gap-3 text-xs text-text-2">
      <span aria-hidden="true" className="h-px flex-1 bg-hair" />
      {children}
      <span aria-hidden="true" className="h-px flex-1 bg-hair" />
    </li>
  );
}

interface MessageBubbleProps {
  /** `mine`: the viewer's own message, on the other side with the tinted bubble. */
  side: 'mine' | 'other';
  /** Shown above the bubble ("You", "Maryam Kazemi"). */
  author: string;
  /** The avatar's letter comes from this name. */
  avatarName: string;
  /** "Supervisor". */
  role?: string | undefined;
  /** "Very urgent", "Automatic reply". */
  tag?: { label: string; tone: ChipTone } | undefined;
  /** Formatted time, and its machine-readable value. */
  time: string;
  dateTime: string;
  text: string;
  /** Rich content shown in the bubble instead of `text` (an assistant's formatted answer). */
  body?: ReactNode;
  /** An automatic reply: outlined bubble instead of a filled one. */
  outlined?: boolean;
  attachment?: { name: string; url: string } | null | undefined;
  /** Under own messages: "Seen", "Sent". */
  status?: ReactNode;
  /** Under the bubble: a rating. */
  footer?: ReactNode;
  /** Narrower spacing (home page card). */
  compact?: boolean;
}

/** One message of a conversation: avatar, who and when, the text, a file, and what's under it. */
export function MessageBubble({
  side,
  author,
  avatarName,
  role,
  tag,
  time,
  dateTime,
  text,
  body,
  outlined = false,
  attachment,
  status,
  footer,
  compact = false,
}: MessageBubbleProps) {
  const mine = side === 'mine';
  const bubble = outlined
    ? 'bg-transparent shadow-[inset_0_0_0_1px_var(--line-2)]'
    : mine
      ? 'bg-tint'
      : 'bg-canvas';

  return (
    <li
      className={`flex gap-2.5 ${compact ? 'items-start' : 'items-end'} ${mine ? 'flex-row-reverse' : ''}`}
    >
      <Avatar name={avatarName} size="sm" tone={mine ? 'tint' : 'hero'} />
      <div
        className={`flex min-w-0 flex-col gap-1.5 ${
          compact ? 'max-w-[82%]' : 'max-w-[84%] lg:max-w-[72%]'
        } ${mine ? 'items-end' : 'items-start'}`}
      >
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-2">
          <span className="font-semibold text-text">{author}</span>
          {role && <span>{role}</span>}
          {tag && (
            <Chip tone={tag.tone} small>
              {tag.label}
            </Chip>
          )}
          <time dateTime={dateTime}>{time}</time>
        </div>
        {body ? (
          <div
            className={`rounded-[20px] px-4 py-3 text-[15px] leading-[1.85] break-words ${
              mine ? 'rounded-ee-md' : 'rounded-es-md'
            } ${bubble}`}
          >
            {body}
          </div>
        ) : (
          <p
            className={`m-0 rounded-[20px] px-4 py-3 text-[15px] leading-[1.85] break-words whitespace-pre-line ${
              mine ? 'rounded-ee-md' : 'rounded-es-md'
            } ${bubble}`}
          >
            {text}
          </p>
        )}
        {attachment && (
          <a
            href={safeHref(attachment.url)}
            target="_blank"
            rel="noopener"
            className="inline-flex min-h-11 max-w-full items-center gap-2 rounded-full px-3.5 text-[13px] text-text shadow-[inset_0_0_0_1px_var(--line-2)]"
          >
            <Icon name="paperclip" size={16} className="flex-none" />
            <bdi className="truncate">{attachment.name}</bdi>
          </a>
        )}
        {status && <span className="text-xs text-text-2">{status}</span>}
        {footer}
      </div>
    </li>
  );
}
