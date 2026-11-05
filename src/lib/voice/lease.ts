import { useSyncExternalStore } from 'react';

let owner: symbol | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

/** Multiple fields may offer dictation, but only one may capture/process audio at a time. */
export function acquireVoice(key: symbol) {
  if (owner !== null) return false;
  owner = key;
  emit();
  return true;
}

export function releaseVoice(key: symbol) {
  if (owner !== key) return;
  owner = null;
  emit();
}

export function useVoiceOwner() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => owner,
  );
}
