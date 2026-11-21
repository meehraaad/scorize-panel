import { createContext, type ReactNode } from 'react';

/** Where a screen's buttons go (`Bar` in answers.tsx), set by the quiz's frame. */
export interface BarPlace {
  /**
   * The buttons stay in view over long answers: in the popup, on the plain page, and (phones) once
   * the questions fill the screen. Inside the panel's page on wide screens they follow the answers.
   */
  pinned: boolean;
  /** Wide screens (lg up): buttons under the answers. Phones: a bar at the bottom of the screen. */
  wide: boolean;
  /** Phones: the bottom bar the buttons are drawn into, under the scrolling question. */
  slot: HTMLElement | null;
  /** Phones: the first route's strip, shown above the buttons once it is ready. */
  peek: ReactNode;
}

export const BarContext = createContext<BarPlace>({
  pinned: false,
  wide: true,
  slot: null,
  peek: null,
});
