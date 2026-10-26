import { useCallback, useEffect, useRef, useState } from 'react';
import { useBlocker } from 'react-router';
import i18n from '@/lib/i18n';
import { toast } from '@/lib/toast';
import { useSaveInfo, UnknownNameError, type CustomerInfo, type InfoSection } from './api';

export type SectionName = keyof InfoSection;
type RowKey = { localId: string };
export type InfoDraft = Omit<CustomerInfo, 'education' | 'exams'> & {
  education: (CustomerInfo['education'][number] & RowKey)[];
  exams: (CustomerInfo['exams'][number] & RowKey)[];
};
export type SaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'incomplete' | 'error';
const SECTIONS: SectionName[] = ['personal', 'goal', 'education', 'exams'];
const DELAY = 1000;

function incomplete(key: SectionName, draft: InfoDraft) {
  if (key === 'education')
    return draft.education.some((row) => !row.degree || !row.university.trim() || !row.gpa.trim());
  if (key === 'exams') return draft.exams.some((row) => !row.exam || !row.score.trim());
  return false;
}

/** One queue for the page: section PATCH responses must never race or replace newer input. */
export function useInfoAutosave(id: number, initial: CustomerInfo) {
  const { mutateAsync } = useSaveInfo(id);
  const [draft, setDraft] = useState<InfoDraft>(() => ({
    ...initial,
    education: initial.education.map((row) => ({ ...row, localId: crypto.randomUUID() })),
    exams: initial.exams.map((row) => ({ ...row, localId: crypto.randomUUID() })),
  }));
  const current = useRef(draft);
  const pending = useRef(new Set<SectionName>());
  const failures = useRef(new Set<SectionName>());
  const [statuses, setStatuses] = useState<Record<SectionName, SaveStatus>>({
    personal: 'idle',
    goal: 'idle',
    education: 'idle',
    exams: 'idle',
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<SectionName, unknown>>>({});
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const inFlight = useRef<Promise<boolean> | null>(null);
  const status = useCallback((key: SectionName, value: SaveStatus) => {
    setStatuses((previous) => ({ ...previous, [key]: value }));
  }, []);

  const flush = useCallback((): Promise<boolean> => {
    clearTimeout(timer.current);
    if (inFlight.current) return inFlight.current;
    const run = async () => {
      for (;;) {
        const key = SECTIONS.find(
          (name) =>
            pending.current.has(name) &&
            !failures.current.has(name) &&
            !incomplete(name, current.current),
        );
        if (!key) return pending.current.size === 0;
        const sent = current.current;
        const section: InfoSection =
          key === 'education'
            ? { education: sent.education.map(({ localId: _localId, ...row }) => row) }
            : key === 'exams'
              ? { exams: sent.exams.map(({ localId: _localId, ...row }) => row) }
              : { [key]: sent[key] };
        pending.current.delete(key);
        status(key, 'saving');
        try {
          const stored = await mutateAsync(section);
          // Match new server IDs through stable local row keys, including edits/removals made
          // during the request. Keep the user's spelling and all newer field values.
          if (key === 'education' || key === 'exams') {
            const ids = new Map(
              sent[key].map((row, index) => [row.localId, stored[key][index]?.id]),
            );
            const rows = current.current[key].map((row) => {
              const serverId = ids.get(row.localId);
              return serverId === undefined ? row : { ...row, id: serverId };
            });
            current.current = { ...current.current, [key]: rows };
            setDraft(current.current);
          }
          status(
            key,
            pending.current.has(key)
              ? incomplete(key, current.current)
                ? 'incomplete'
                : 'pending'
              : 'saved',
          );
        } catch (error) {
          pending.current.add(key);
          // A correction typed during a failed request gets its own attempt.
          if (current.current[key] === sent[key]) failures.current.add(key);
          setErrors((previous) => ({ ...previous, [key]: error }));
          status(key, 'error');
          if (failures.current.has(key))
            toast.error(
              error instanceof UnknownNameError
                ? i18n.t('sales:info.notFound', { value: error.value })
                : i18n.t('sales:info.autosave.error'),
            );
        }
      }
    };
    setSaving(true);
    inFlight.current = run().finally(() => {
      inFlight.current = null;
      setSaving(false);
    });
    return inFlight.current;
  }, [mutateAsync, status]);

  const update = useCallback(
    <K extends SectionName>(key: K, value: InfoDraft[K]) => {
      current.current = { ...current.current, [key]: value };
      setDraft(current.current);
      pending.current.add(key);
      failures.current.delete(key);
      status(key, incomplete(key, current.current) ? 'incomplete' : 'pending');
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        void flush();
      }, DELAY);
    },
    [flush, status],
  );

  const retry = useCallback(
    (key?: SectionName) => {
      if (key) failures.current.delete(key);
      else failures.current.clear();
      void flush();
    },
    [flush],
  );

  // Block internal navigation until the queue is saved; failed/unfinished input stays editable.
  const blocker = useBlocker(
    useCallback(
      ({ currentLocation, nextLocation }) =>
        currentLocation.pathname !== nextLocation.pathname &&
        (pending.current.size > 0 || inFlight.current !== null),
      [],
    ),
  );
  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    let active = true;
    void flush().then((saved) => {
      if (active && saved) blocker.proceed();
    });
    return () => {
      active = false;
    };
  }, [blocker, flush]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (pending.current.size || inFlight.current) event.preventDefault();
    };
    const online = () => retry();
    window.addEventListener('beforeunload', warn);
    window.addEventListener('online', online);
    return () => {
      clearTimeout(timer.current);
      window.removeEventListener('beforeunload', warn);
      window.removeEventListener('online', online);
    };
  }, [retry]);

  return { draft, update, statuses, errors, saving, flush, retry, blocker };
}
