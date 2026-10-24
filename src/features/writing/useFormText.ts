import { useTranslation } from 'react-i18next';
import type { FormType } from './formSpec';

/**
 * Text of one form, from `writing:<type>.<key>`. Keys are built from the form's spec, so they
 * aren't checked by TypeScript here; writing.test.ts checks every one exists in every language.
 */
export function useFormText(type: FormType) {
  const { t, i18n } = useTranslation('writing');
  // Keys are built at runtime, so look them up untyped; the result is always a string.
  const lookup = t as unknown as (key: string, values?: Record<string, string>) => string;
  const text = (key: string, values?: Record<string, string>) => lookup(`${type}.${key}`, values);
  const has = (key: string) => i18n.exists(`writing:${type}.${key}`);
  return { text, has };
}
