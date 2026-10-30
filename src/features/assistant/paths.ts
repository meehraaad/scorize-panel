/**
 * Router paths of the founders panel (src/panels/founders, at /founders). Features can't import
 * panels, so the root is repeated here.
 */
export const FOUNDERS_ROOT = '/founders';

export const conversationPath = (id: number) => `${FOUNDERS_ROOT}/conversations/${String(id)}`;
