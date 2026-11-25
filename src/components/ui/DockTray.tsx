import { createContext, use, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

const TrayContext = createContext<HTMLElement | null>(null);

/**
 * The bottom corner where minimized things wait (the tasks pill, a seller's unsaved logs and calls):
 * one row for all of them, so they line up instead of covering each other. Above the bottom tabs
 * on phones, where it steps aside while a floating form is open (it would sit on top of it).
 * Open windows (FloatingPanel) take the other corner.
 */
export function DockTray({ children }: { children: ReactNode }) {
  const [element, setElement] = useState<HTMLElement | null>(null);
  return (
    <TrayContext value={element}>
      {children}
      <div
        ref={setElement}
        className="pointer-events-none fixed start-3 end-3 bottom-[calc(88px+env(safe-area-inset-bottom))] z-40 flex max-h-32 flex-wrap items-end gap-2 overflow-y-auto *:pointer-events-auto empty:hidden lg:start-5 lg:end-auto lg:bottom-5 lg:max-w-[calc(100vw-490px)] print:hidden max-lg:[body:has([data-floating])_&]:hidden"
      />
    </TrayContext>
  );
}

/** Puts `children` in the tray (nothing outside a DockTray). */
export function InTray({ children }: { children: ReactNode }) {
  const element = use(TrayContext);
  return element ? createPortal(children, element) : null;
}
