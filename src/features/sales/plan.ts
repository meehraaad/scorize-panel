/** The first instalment is this share of the total, rounded to 100,000 toman. */
const FIRST_SHARE = 0.4;
const ROUND = 100_000;

/**
 * A preview of due dates and amounts: the first at signing, then one a month after the start date.
 * The server sets the real schedule when the contract is approved.
 */
export function instalmentPlan(total: number, count: number, start: string) {
  if (count <= 1) return [{ due: null, amount: total }];
  const first = Math.round((total * FIRST_SHARE) / ROUND) * ROUND;
  const rest = (total - first) / (count - 1);
  const from = new Date(start);
  return Array.from({ length: count }, (_, index) => {
    if (index === 0) return { due: null, amount: first };
    const due = new Date(from.getFullYear(), from.getMonth() + index, from.getDate());
    return { due: due.toISOString(), amount: Math.round(rest) };
  });
}
