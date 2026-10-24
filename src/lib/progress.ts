/** 0–100, safe for an empty total. */
export const percentOf = (done: number, total: number) =>
  total > 0 ? Math.min(100, Math.max(0, Math.round((done / total) * 100))) : 100;

export type StepState = 'done' | 'current' | 'todo';

/** Where step `index` is, given the current one (`finished`: the current step is done too). */
export const stepState = (index: number, current: number, finished = false): StepState =>
  index < current || (finished && index === current)
    ? 'done'
    : index === current
      ? 'current'
      : 'todo';
