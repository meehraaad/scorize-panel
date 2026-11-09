import { wordDiff } from '@/lib/textDiff';

/**
 * A text with what was removed struck through and what was added highlighted, word by word
 * (contract clauses: what a seller changed). `addedLabel` / `removedLabel` are read by screen
 * readers before each changed run.
 */
export function DiffText({
  before,
  after,
  addedLabel,
  removedLabel,
}: {
  before: string;
  after: string;
  addedLabel: string;
  removedLabel: string;
}) {
  return (
    <>
      {wordDiff(before, after).map((part, index) =>
        part.kind === 'same' ? (
          <span key={index}>{part.text}</span>
        ) : part.kind === 'added' ? (
          <ins key={index} className="rounded bg-good-tint px-0.5 text-good no-underline">
            <span className="sr-only">{addedLabel}</span>
            {part.text}
          </ins>
        ) : (
          <del key={index} className="rounded bg-danger-tint px-0.5 text-danger">
            <span className="sr-only">{removedLabel}</span>
            {part.text}
          </del>
        ),
      )}
    </>
  );
}
