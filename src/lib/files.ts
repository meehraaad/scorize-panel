/** Why a picked file can't be sent (checked before uploading, so a phone doesn't send 30 MB to be refused). */
export type FileProblem = 'badType' | 'tooBig';

export interface FileRule {
  /** MIME types accepted, e.g. ['application/pdf', 'image/jpeg']. */
  types: readonly string[];
  maxBytes: number;
}

export function checkFile(file: File, rule: FileRule): FileProblem | null {
  if (!rule.types.includes(file.type)) return 'badType';
  if (file.size > rule.maxBytes) return 'tooBig';
  return null;
}

/** "passport.pdf" → "PDF" (shown on the file's tile). */
export const extensionOf = (name: string) =>
  name.includes('.') ? (name.split('.').pop() ?? '').toUpperCase() : '';
