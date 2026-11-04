import { Icon } from './Icon';

/** A tag's color: `primary`/`neutral` for plain lists, the rest for labels people pick (customer tags). */
export type TagTone =
  'primary' | 'neutral' | 'blue' | 'green' | 'amber' | 'red' | 'purple' | 'gray';

const TONES: Record<TagTone, string> = {
  primary: 'bg-tint text-primary-text',
  neutral: 'bg-neutral-tint text-neutral',
  blue: 'bg-info-tint text-info',
  green: 'bg-good-tint text-good',
  amber: 'bg-warn-tint text-warn',
  red: 'bg-danger-tint text-danger',
  purple: 'bg-tint text-primary-text',
  gray: 'bg-neutral-tint text-neutral',
};

/**
 * A list of short labels (research interests, topics, countries). With `onRemove`, each tag gets a
 * remove button (44px hit area inside the chip). `latin`: English labels, laid out left to right.
 * `toneOf`: each tag's own color (customer tags); otherwise every tag has `tone`.
 */
export function TagList({
  label,
  tags,
  tone = 'primary',
  toneOf,
  size = 'md',
  removeLabel,
  onRemove,
  disabled = false,
  latin = true,
}: {
  label: string;
  tags: readonly string[];
  tone?: TagTone;
  toneOf?: (tag: string) => TagTone;
  /** `sm` for tags inside a table row. */
  size?: 'sm' | 'md';
  removeLabel?: (tag: string) => string;
  onRemove?: (tag: string) => void;
  disabled?: boolean;
  latin?: boolean;
}) {
  const height = size === 'sm' ? 'h-[26px] text-xs' : 'h-9 text-sm';
  // A remove button fills the end of the chip; otherwise pad both sides.
  const pad = size === 'sm' ? (onRemove ? 'ps-2.5' : 'px-2.5') : onRemove ? 'ps-3.5' : 'px-3.5';
  return (
    <ul
      aria-label={label}
      dir={latin ? 'ltr' : undefined}
      className={`m-0 flex list-none flex-wrap p-0 ${latin ? 'justify-end' : ''} ${size === 'sm' ? 'gap-1.5' : 'gap-2'}`}
    >
      {tags.map((tag) => (
        <li
          key={tag}
          className={`inline-flex items-center rounded-full font-medium ${height} ${pad} ${TONES[toneOf?.(tag) ?? tone]}`}
        >
          {tag}
          {onRemove && (
            <button
              type="button"
              aria-label={removeLabel?.(tag) ?? tag}
              disabled={disabled}
              onClick={() => onRemove(tag)}
              className="-my-1 flex size-11 items-center justify-center rounded-full disabled:opacity-50"
            >
              <Icon name="close" size={14} />
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
