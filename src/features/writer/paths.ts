export const WRITING_QUEUE = '/executive/writing';

export const orderPath = (id: number) => `${WRITING_QUEUE}/orders/${String(id)}`;
