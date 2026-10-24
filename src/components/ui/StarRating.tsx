import { Icon } from './Icon';

/**
 * Score buttons (1 to `max` stars). Labels come from the caller, already translated, so this works
 * in any feature: `starLabel(3)` → "3 out of 5".
 */
export function StarRating({
  prompt,
  max = 5,
  starLabel,
  disabled = false,
  onRate,
}: {
  /** Shown before the stars ("Rate this reply"). */
  prompt: string;
  max?: number;
  starLabel: (score: number) => string;
  disabled?: boolean;
  onRate: (score: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-1 text-[13px] text-text-2">
      <span>{prompt}</span>
      <span className="flex">
        {Array.from({ length: max }, (_, index) => index + 1).map((score) => (
          <button
            key={score}
            type="button"
            aria-label={starLabel(score)}
            disabled={disabled}
            onClick={() => onRate(score)}
            className="flex size-11 items-center justify-center rounded-full text-text-2 hover:text-primary-text disabled:opacity-50"
          >
            <Icon name="star" size={18} />
          </button>
        ))}
      </span>
    </div>
  );
}

/** A given score as filled stars (decorative: say the score in text beside it). */
export function StarScore({ value, max = 5 }: { value: number; max?: number }) {
  return (
    <span aria-hidden="true" className="flex">
      {Array.from({ length: max }, (_, index) => index + 1).map((star) => (
        <Icon
          key={star}
          name="star"
          size={16}
          filled={star <= value}
          className={star <= value ? 'text-warn' : 'text-text-3'}
        />
      ))}
    </span>
  );
}
