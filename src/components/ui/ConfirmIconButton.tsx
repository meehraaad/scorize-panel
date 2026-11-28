import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from './Button';
import { IconButton } from './IconButton';
import type { IconName } from './Icon';

interface ConfirmIconButtonProps {
  /** What it removes, as its name ("Delete the tag VIP"). */
  'aria-label': string;
  onConfirm: () => void;
  icon?: IconName;
  /** What the second press says: «بله، حذف» or «بله، بایگانی». */
  action?: 'delete' | 'archive';
  disabled?: boolean;
}

const ARMED_MS = 4000;

/**
 * A destructive icon button that asks once, in place: the first press turns it into a red «بله،
 * حذف», the second does it. It goes back by itself after a few seconds, on Escape or when focus
 * leaves, so a slip of the finger in a list never deletes a row.
 */
export function ConfirmIconButton({
  'aria-label': label,
  onConfirm,
  icon = 'trash',
  action = 'delete',
  disabled = false,
}: ConfirmIconButtonProps) {
  const { t } = useTranslation();
  const [armed, setArmed] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const disarm = () => {
    window.clearTimeout(timer.current);
    setArmed(false);
  };

  if (!armed)
    return (
      <IconButton
        icon={icon}
        tone="danger"
        aria-label={label}
        disabled={disabled}
        onClick={() => {
          setArmed(true);
          timer.current = window.setTimeout(() => setArmed(false), ARMED_MS);
        }}
      />
    );
  const yes = t(`confirm.${action}`);
  return (
    <Button
      variant="danger"
      className="flex-none px-3 text-[13px] shadow-[inset_0_0_0_1px_var(--danger)]"
      aria-label={`${label}: ${yes}`}
      autoFocus
      disabled={disabled}
      onBlur={disarm}
      onKeyDown={(event) => {
        if (event.key === 'Escape') disarm();
      }}
      onClick={() => {
        disarm();
        onConfirm();
      }}
    >
      {yes}
    </Button>
  );
}
