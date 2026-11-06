import type { ClauseEdit } from './api';

/** Every changed clause has a text, and an added one its title too (Django refuses them otherwise). */
export const clausesComplete = (edits: ClauseEdit[]) =>
  edits.every(
    (edit) => edit.removed || (edit.text.trim() && (edit.clause !== null || edit.title.trim())),
  );
