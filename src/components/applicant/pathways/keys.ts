import type { ParseKeys } from 'i18next';

/** A key built at run time (a question's, a status's): one of the finder's dictionary. */
export const key = (name: string) => name as ParseKeys<'pathways'>;
