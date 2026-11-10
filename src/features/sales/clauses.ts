import type { ClauseEdit } from './api';

/**
 * Every clause added has a text, and an article added its title too; a changed clause keeps a text
 * unless it is an article (S69). Django refuses them otherwise.
 */
export const clausesComplete = (edits: ClauseEdit[]) =>
  edits.every((edit) =>
    edit.removed
      ? true
      : edit.clause === null
        ? edit.text.trim() !== '' && (edit.kind !== 'article' || edit.title.trim() !== '')
        : edit.text.trim() !== '' || edit.kind === 'article',
  );
