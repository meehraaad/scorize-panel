/** A CSV the server accepts (some systems send no type, or Excel's, for .csv). */
export const isCsv = (file: File) =>
  file.name.toLowerCase().endsWith('.csv') &&
  ['text/csv', 'application/vnd.ms-excel', 'text/plain', ''].includes(file.type);

/** Django's imports read at most 2 MB (`MAX_MB`). */
export const MAX_CSV_BYTES = 2 * 1024 * 1024;
