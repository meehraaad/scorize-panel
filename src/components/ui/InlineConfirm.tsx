import type { ReactNode } from 'react';
import { Button } from './Button';

interface InlineConfirmProps {
  /** Names what will happen ("Reject the application to McGill?"). */
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  /** Extra input the action takes (an optional reason), shown under the message. */
  children?: ReactNode;
}

/** Second step of a destructive action, shown in place instead of a modal. */
export function InlineConfirm({
  message,
  confirmLabel,
  cancelLabel,
  pending = false,
  onConfirm,
  onCancel,
  children,
}: InlineConfirmProps) {
  return (
    <div
      role="group"
      aria-label={message}
      className="flex w-full flex-wrap items-center justify-between gap-3 rounded-2xl bg-danger-tint px-4 py-3"
    >
      <span className="text-[15px] leading-7 text-danger">{message}</span>
      {children && <div className="w-full">{children}</div>}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={pending} onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button
          variant="danger"
          className="shadow-[inset_0_0_0_1px_var(--danger)]"
          disabled={pending}
          onClick={onConfirm}
        >
          {confirmLabel}
        </Button>
      </div>
    </div>
  );
}
