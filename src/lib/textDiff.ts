/** A run of words in a comparison: in both texts, only in the new one, or only in the old one. */
export interface DiffPart {
  kind: 'same' | 'added' | 'removed';
  text: string;
}

/** Longest texts compared word by word; beyond this the whole text shows as replaced. */
const MAX_WORDS = 1500;

/**
 * Word-level difference between two texts (whitespace kept with its word), for highlighting what
 * a seller changed in a contract clause. A longest-common-subsequence table: fine for clauses.
 */
export function wordDiff(before: string, after: string): DiffPart[] {
  const a = before.match(/\S+\s*|\s+/g) ?? [];
  const b = after.match(/\S+\s*|\s+/g) ?? [];
  if (a.length * b.length > MAX_WORDS * MAX_WORDS)
    return merge([
      { kind: 'removed', text: before },
      { kind: 'added', text: after },
    ]);
  const key = (words: string[], at: number) => (words[at] ?? '').trim();
  // table[i * width + j]: the longest common run of a[i:] and b[j:].
  const width = b.length + 1;
  const table = new Uint16Array((a.length + 1) * width);
  const at = (i: number, j: number) => table[i * width + j] ?? 0;
  for (let i = a.length - 1; i >= 0; i -= 1)
    for (let j = b.length - 1; j >= 0; j -= 1)
      table[i * width + j] =
        key(a, i) === key(b, j) ? at(i + 1, j + 1) + 1 : Math.max(at(i + 1, j), at(i, j + 1));
  const parts: DiffPart[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (key(a, i) === key(b, j)) {
      parts.push({ kind: 'same', text: b[j] ?? '' });
      i += 1;
      j += 1;
    } else if (at(i + 1, j) >= at(i, j + 1)) {
      parts.push({ kind: 'removed', text: a[i] ?? '' });
      i += 1;
    } else {
      parts.push({ kind: 'added', text: b[j] ?? '' });
      j += 1;
    }
  }
  parts.push(
    ...a.slice(i).map((text) => ({ kind: 'removed' as const, text })),
    ...b.slice(j).map((text) => ({ kind: 'added' as const, text })),
  );
  return merge(parts);
}

/** Joins neighbours of the same kind, and drops empty runs. */
function merge(parts: DiffPart[]): DiffPart[] {
  const merged: DiffPart[] = [];
  for (const part of parts) {
    if (!part.text) continue;
    const last = merged.at(-1);
    if (last?.kind === part.kind) last.text += part.text;
    else merged.push({ ...part });
  }
  return merged;
}
