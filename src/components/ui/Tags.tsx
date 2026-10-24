import { Icon } from './Icon';

/**
 * A list of short labels (research interests, topics, countries). With `onRemove`, each tag gets a
 * remove button (44px hit area inside the chip). `latin`: English labels, laid out left to right.
 */
export function TagList({
  label,
  tags,
  tone = 'primary',
  size = 'md',
  removeLabel,
  onRemove,
  disabled = false,
  latin = true,
}: {
  label: string;
  tags: readonly string[];
  tone?: 'primary' | 'neutral';
  /** `sm` for tags inside a table row. */
  size?: 'sm' | 'md';
  removeLabel?: (tag: string) => string;
  onRemove?: (tag: string) => void;
  disabled?: boolean;
  latin?: boolean;
}) {
  const look = tone === 'primary' ? 'bg-tint text-primary-text' : 'bg-neutral-tint text-neutral';
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
          className={`inline-flex items-center rounded-full font-medium ${height} ${pad} ${look}`}
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
