import { useState } from 'react';

const KEY = 'scorize-tasks-dock';

/** Whose tab it is: another account signing in on it starts with the dock closed. */
function read(owner: number) {
  try {
    return sessionStorage.getItem(KEY) === String(owner);
  } catch {
    return false;
  }
}

/**
 * The tasks dock open or closed, kept for this tab (like the case chats' dock): a reload or another
 * page keeps it as it was, a new tab starts closed. Stored with the account's id.
 */
export function useDockOpen(owner: number) {
  const [open, setOpen] = useState(() => read(owner));
  const change = (value: boolean) => {
    setOpen(value);
    try {
      if (value) sessionStorage.setItem(KEY, String(owner));
      else sessionStorage.removeItem(KEY);
    } catch {
      // Private mode: the dock still opens, it is only not remembered.
    }
  };
  return [open, change] as const;
}
