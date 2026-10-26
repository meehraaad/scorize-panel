import { useEffect, type ReactNode } from 'react';

/**
 * The page body: a main column and a side column that drops under it on narrow screens (no
 * breakpoint juggling: flex-basis does it). The side column is an <aside> named by `asideLabel`.
 */
export function PageColumns({
  main,
  aside,
  asideLabel,
  asideWidth = 'md',
  fill = false,
}: {
  main: ReactNode;
  aside?: ReactNode;
  asideLabel: string;
  /** `sm` ~300px (forms' tips), `md` ~350px (summaries). */
  asideWidth?: 'sm' | 'md';
  /**
   * Inside PageFill: on phones the main column takes the remaining height and the side column is
   * hidden (the page offers it another way, e.g. a Sheet). Normal columns from lg up.
   */
  fill?: boolean;
}) {
  return (
    <div
      className={`flex flex-wrap items-start gap-4 lg:gap-7 ${
        fill ? 'max-lg:min-h-0 max-lg:flex-1 max-lg:flex-nowrap max-lg:items-stretch' : ''
      }`}
    >
      <div
        className={`flex min-w-0 flex-[999_1_560px] flex-col gap-4 lg:gap-7 ${
          fill ? 'max-lg:min-h-0' : ''
        }`}
      >
        {main}
      </div>
      {aside && (
        <aside
          aria-label={asideLabel}
          className={`flex min-w-0 flex-col gap-4 lg:gap-7 ${
            asideWidth === 'sm' ? 'flex-[1_1_300px]' : 'flex-[1_1_350px]'
          } ${fill ? 'max-lg:hidden' : ''}`}
        >
          {aside}
        </aside>
      )}
    </div>
  );
}

/** Vertical stack of a page: header, then sections. `wide` spacing for pages of titled sections. */
export function PageStack({
  children,
  spacing = 'md',
}: {
  children: ReactNode;
  spacing?: 'md' | 'wide';
}) {
  return (
    <div className={`flex flex-col ${spacing === 'wide' ? 'gap-7 lg:gap-10' : 'gap-4 lg:gap-7'}`}>
      {children}
    </div>
  );
}

/**
 * A page that fills the screen between the header and the bottom tabs on phones, like a chat app:
 * nothing scrolls but the box inside that asks to (the conversation). Normal page flow from lg up.
 * Uses --panel-top / --panel-bottom from PanelLayout, which also hides its footer on phones while a
 * PageFill is shown (`data-page-fill`).
 */
export function PageFill({ children }: { children: ReactNode }) {
  return (
    <div
      data-page-fill
      className="flex flex-col gap-3 max-lg:-mb-10 max-lg:h-[calc(100dvh-var(--panel-top)-var(--panel-bottom))] lg:gap-7"
    >
      {children}
    </div>
  );
}

/** Full-width, viewport-height workspace. PanelLayout opts in only while this block is mounted. */
export function PageWorkspace({
  children,
  fullscreen,
  onExitFullscreen,
}: {
  children: ReactNode;
  fullscreen: boolean;
  onExitFullscreen: () => void;
}) {
  useEffect(() => {
    if (!fullscreen) return;
    const exit = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      if (event.target instanceof Element && event.target.closest('dialog[open]')) return;
      onExitFullscreen();
    };
    window.addEventListener('keydown', exit);
    return () => window.removeEventListener('keydown', exit);
  }, [fullscreen, onExitFullscreen]);

  return (
    <div
      data-page-workspace
      data-workspace-fullscreen={fullscreen || undefined}
      className={`isolate flex min-h-0 w-full min-w-0 flex-col overflow-hidden ${
        fullscreen ? 'h-dvh' : 'h-[calc(100dvh-var(--panel-top,0px)-var(--panel-bottom,0px))]'
      }`}
    >
      {children}
    </div>
  );
}
