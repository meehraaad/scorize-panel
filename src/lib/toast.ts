import { useSyncExternalStore } from 'react';

/**
 * Toasts: the panel's messages about what an action did ("saved", "not sent", upload progress).
 * Call `toast.success(t('saved'))` from anywhere (a mutation's onSuccess, an event handler); the
 * <Toaster> mounted once by the app shows them. Messages that belong next to a field (validation)
 * or that describe the page (read-only, past consultation) stay inline as <Notice>.
 */

export type ToastKind = 'success' | 'error' | 'info' | 'warn' | 'uploading' | 'paused';

export interface ToastFile {
  name: string;
  state: 'done' | 'up' | 'wait';
  /** 0–1, while state is 'up'. */
  progress?: number;
}

export interface ToastAction {
  /** A verb: "Send again", "Choose another file". */
  label: string;
  run: () => void;
}

export interface ToastData {
  id: number;
  kind: ToastKind;
  title: string;
  meta?: string | undefined;
  /** 0–1 for uploads: drawn as the ring around the icon. */
  progress?: number | undefined;
  action?: ToastAction | undefined;
  /** Several files in one upload: listed under the title, collapsible. */
  files?: readonly ToastFile[] | undefined;
  /** Runs when the person closes the toast (an upload's close button cancels it). */
  onClose?: (() => void) | undefined;
  /** The close button's name when it does more than close ("Cancel upload"). */
  closeLabel?: string | undefined;
}

export type ToastInput = Omit<ToastData, 'id' | 'kind'>;
type Options = Omit<ToastInput, 'title'>;

/** Success and info close themselves; errors, warnings and uploads wait for the person. */
export const AUTO_HIDE_MS = 5000;
/** More than this and the oldest goes: a stack of toasts hides the page. */
export const MAX_TOASTS = 3;

let toasts: readonly ToastData[] = [];
let lastId = 0;
const listeners = new Set<() => void>();
const timers = new Map<number, ReturnType<typeof setTimeout>>();
const held = new Set<number>();

const emit = () => listeners.forEach((listener) => listener());
const autoHides = (kind: ToastKind) => kind === 'success' || kind === 'info';

function schedule(id: number) {
  clearTimeout(timers.get(id));
  timers.delete(id);
  const item = toasts.find((x) => x.id === id);
  if (!item || !autoHides(item.kind) || held.has(id)) return;
  timers.set(
    id,
    setTimeout(() => dismiss(id), AUTO_HIDE_MS),
  );
}

function show(kind: ToastKind, input: ToastInput) {
  const id = ++lastId;
  const next = [...toasts, { ...input, id, kind }];
  next.slice(0, Math.max(0, next.length - MAX_TOASTS)).forEach((old) => forget(old.id));
  toasts = next.slice(-MAX_TOASTS);
  schedule(id);
  emit();
  return id;
}

function forget(id: number) {
  clearTimeout(timers.get(id));
  timers.delete(id);
  held.delete(id);
}

function dismiss(id: number) {
  if (!toasts.some((x) => x.id === id)) return;
  forget(id);
  toasts = toasts.filter((x) => x.id !== id);
  emit();
}

/** Changes a toast in place (an upload's progress, then its result). */
function update(id: number, patch: Partial<Omit<ToastData, 'id'>>) {
  if (!toasts.some((x) => x.id === id)) return;
  toasts = toasts.map((x) => (x.id === id ? { ...x, ...patch } : x));
  schedule(id);
  emit();
}

const shorthand =
  (kind: ToastKind) =>
  (title: string, options: Options = {}) =>
    show(kind, { ...options, title });

export const toast = {
  success: shorthand('success'),
  error: shorthand('error'),
  info: shorthand('info'),
  warn: shorthand('warn'),
  show,
  update,
  dismiss,
  /** Hover or focus keeps a toast that would close itself until `release`. */
  hold(id: number) {
    held.add(id);
    schedule(id);
  },
  release(id: number) {
    held.delete(id);
    schedule(id);
  },
  /** Tests: start each case with no toasts. */
  clear() {
    toasts.forEach((x) => forget(x.id));
    toasts = [];
    emit();
  },
};

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const useToasts = () =>
  useSyncExternalStore(
    subscribe,
    () => toasts,
    () => toasts,
  );
