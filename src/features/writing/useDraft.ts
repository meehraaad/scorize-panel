import { useCallback, useEffect, useRef, useState } from 'react';
import { useBlocker } from 'react-router';
import { useSaveWriting, type WritingForm } from './api';
import type { AnswerValue, Answers, FormType } from './formSpec';

const AUTOSAVE_MS = 1000;

/** Draft PATCHes never submit the form. Drain newer edits in order before a final submission. */
export function useDraft(type: FormType, form: WritingForm) {
  const save = useSaveWriting(type);
  const [answers, setAnswers] = useState<Answers>(form.answers);
  const latest = useRef(answers);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const pending = useRef<Answers>({});
  const inFlight = useRef<Promise<void> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const { mutateAsync } = save;

  const flush = useCallback((): Promise<void> => {
    clearTimeout(timer.current);
    if (inFlight.current) return inFlight.current;
    const run = async () => {
      while (Object.keys(pending.current).length) {
        const changes = pending.current;
        pending.current = {};
        try {
          await mutateAsync({ answers: changes });
        } catch (error) {
          pending.current = { ...changes, ...pending.current };
          throw error;
        }
      }
      setDirty(false);
    };
    setSaving(true);
    inFlight.current = run().finally(() => {
      inFlight.current = null;
      setSaving(false);
    });
    return inFlight.current;
  }, [mutateAsync]);

  const update = useCallback(
    (name: string, value: AnswerValue) => {
      if (form.is_final) return;
      latest.current = { ...latest.current, [name]: value };
      setAnswers(latest.current);
      pending.current = { ...pending.current, [name]: value };
      setDirty(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        void flush().catch(() => undefined);
      }, AUTOSAVE_MS);
    },
    [flush, form.is_final],
  );

  const saveNow = useCallback(() => {
    void flush().catch(() => undefined);
  }, [flush]);
  const getAnswers = useCallback(() => latest.current, []);

  const blocker = useBlocker(
    useCallback(
      ({ currentLocation, nextLocation }) =>
        currentLocation.pathname !== nextLocation.pathname &&
        (Object.keys(pending.current).length > 0 || inFlight.current !== null),
      [],
    ),
  );
  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    let active = true;
    void flush()
      .then(() => {
        if (active) blocker.proceed();
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [blocker, flush, dirty]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (Object.keys(pending.current).length || inFlight.current) event.preventDefault();
    };
    const online = () => {
      if (Object.keys(pending.current).length) saveNow();
    };
    window.addEventListener('beforeunload', warn);
    window.addEventListener('online', online);
    return () => {
      clearTimeout(timer.current);
      window.removeEventListener('beforeunload', warn);
      window.removeEventListener('online', online);
    };
  }, [saveNow]);

  const adopt = useCallback((name: string, value: AnswerValue) => {
    latest.current = { ...latest.current, [name]: value };
    setAnswers(latest.current);
  }, []);

  return {
    answers,
    update,
    flush,
    saveNow,
    adopt,
    getAnswers,
    blocker,
    dirty,
    saving,
    failed: save.isError && dirty && !saving,
  };
}
