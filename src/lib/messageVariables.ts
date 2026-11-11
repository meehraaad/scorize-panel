/** Variables in a message text: `{name}`, put in by VariableField's buttons. */
export interface FieldVariable {
  /** Written between braces in the text: `{customer}`. */
  name: string;
  /** What the button says ("Customer's name"). */
  label: string;
  /** Shown in its place in the preview. */
  sample: string;
}

export const PLACEHOLDER = /\{([^{}]*)\}/g;

/** The `{names}` a text uses that aren't among `variables`; null when a brace is left open. */
export function unknownVariables(text: string, variables: readonly FieldVariable[]) {
  const stripped = text.replace(PLACEHOLDER, '');
  if (stripped.includes('{') || stripped.includes('}')) return null;
  const known = new Set(variables.map((variable) => variable.name));
  return [...text.matchAll(PLACEHOLDER)]
    .map((match) => match[1] ?? '')
    .filter((name, index, names) => !known.has(name) && names.indexOf(name) === index);
}
