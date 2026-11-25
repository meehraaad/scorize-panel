import { useEffect, useEffectEvent, type RefObject } from 'react';
import { useLocation } from 'react-router';

type Part = RefObject<HTMLElement | null>;

/**
 * A non-modal popup's way out (disclosure pattern): while `open`, a press outside `root`, Esc or
 * going to another page calls `onDismiss` with how it closed, so Esc can give focus back to the
 * button that opened it. `root`
 * may be several parts (a button rendered elsewhere and its popup). A dialog opened from inside
 * the popup is part of it (its <dialog> stays inside), and takes its own Esc.
 */
export function useDismiss(
  open: boolean,
  root: Part | readonly Part[],
  onDismiss: (how: 'outside' | 'escape' | 'navigate') => void,
) {
  const dismiss = useEffectEvent(onDismiss);
  const inside = useEffectEvent((node: Node | null) =>
    (Array.isArray(root) ? root : [root]).some(
      (part: Part) => !!node && part.current?.contains(node),
    ),
  );
  const { pathname } = useLocation();
  useEffect(() => {
    if (open) dismiss('navigate');
    // Only a new page closes it, not opening it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!inside(event.target as Node)) dismiss('outside');
    };
    const onKey = (event: KeyboardEvent) => {
      const dialog = event.target instanceof Element ? event.target.closest('dialog') : null;
      if (event.key === 'Escape' && !inside(dialog)) dismiss('escape');
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
}
