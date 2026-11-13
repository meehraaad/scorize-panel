/** JSON object order and server provenance are not editable answer changes. */
function equalJson(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((value: unknown, index: number) => equalJson(value, b[index]))
    );
  }
  const one = a as Record<string, unknown>,
    two = b as Record<string, unknown>;
  const keys = Object.keys(one);
  return (
    keys.length === Object.keys(two).length &&
    keys.every((key) => Object.hasOwn(two, key) && equalJson(one[key], two[key]))
  );
}
export function sameAnswerContent(
  a: { status: string; value?: unknown } | undefined,
  b: { status: string; value?: unknown } | undefined,
): boolean {
  if (!a || !b) return a === b;
  return a.status === b.status && equalJson(a.value, b.value);
}
