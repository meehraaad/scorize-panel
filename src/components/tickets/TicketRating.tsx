import { StarRating, StarScore } from '@/components/ui/StarRating';

/**
 * Rating under a staff reply: star buttons until it's rated, then the score. Without `onRate`
 * (staff looking at a reply) only a given score is shown.
 */
export function TicketRating({
  value,
  max = 5,
  prompt,
  ratedLabel,
  starLabel,
  disabled = false,
  onRate,
}: {
  value: number | null;
  max?: number;
  /** "Rate this reply". */
  prompt: string;
  /** "Your rating: 4 out of 5" (shown once rated). */
  ratedLabel: string;
  starLabel: (score: number) => string;
  disabled?: boolean;
  onRate?: ((score: number) => void) | undefined;
}) {
  if (value !== null)
    return (
      <span className="flex flex-wrap items-center gap-1.5 text-[13px] text-text-2">
        <span>{ratedLabel}</span>
        <StarScore value={value} max={max} />
      </span>
    );
  if (!onRate) return null;
  return (
    <StarRating
      prompt={prompt}
      max={max}
      starLabel={starLabel}
      disabled={disabled}
      onRate={onRate}
    />
  );
}
