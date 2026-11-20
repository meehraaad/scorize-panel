import { createContext } from 'react';

/**
 * In the popup and on the plain page the buttons stay at the bottom, over long answers; in the
 * panel they follow the answers (its tab bar is at the bottom on phones).
 */
export const PinnedContext = createContext(false);
