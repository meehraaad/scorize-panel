import { useCallback, useEffect, useRef, useState } from 'react';
import { useSaveWriting, type WritingForm } from './api';
import type { AnswerValue, Answers, FormType } from './formSpec';

/** Save this long after the last keystroke. */
const AUTOSAVE_MS = 1500;

/**
 * The form's answers as the applicant edits them, saved to the server as a draft: shortly after
 * typing stops, when a section changes, and when the page closes. Only changed fields are sent.
 * Unsaved changes survive a failed save and go with the next one; leaving the site asks first.
 */
export function useDraft(type: FormType, form: WritingForm) {
  const save = useSaveWriting(type);
  const [answers, setAnswers] = useState<Answers>(form.answers);
  const [dirty, setDirty] = useState(false);
  const pending = useRef<Answers>({});
  const inFlight = useRef<Promise<unknown>>(Promise.resolve());
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const { mutateAsync } = save;

  /** Sends what's pending now. Rejects if the save fails (the changes stay pending). */
  const flush = useCallback(() => {
    clearTimeout(timer.current);
    // One save at a time, in order: a slow request never overwrites a newer one.
    inFlight.current = inFlight.current
      .catch(() => undefined)
      .then(async () => {
        const changes = pending.current;
        if (!Object.keys(changes).length) return;
        pending.current = {};
        try {
          await mutateAsync({ answers: changes });
        } catch (error) {
          pending.current = { ...changes, ...pending.current };
          throw error;
        }
        if (!Object.keys(pending.current).length) setDirty(false);
      });
    return inFlight.current;
  }, [mutateAsync]);

  const update = useCallback(
    (name: string, value: AnswerValue) => {
      setAnswers((previous) => ({ ...previous, [name]: value }));
      pending.current = { ...pending.current, [name]: value };
      setDirty(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        flush().catch(() => undefined);
      }, AUTOSAVE_MS);
    },
    [flush],
  );

  // Leaving the site with unsaved answers: the browser asks first.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  // Leaving the page inside the panel: send what's pending.
  useEffect(
    () => () => {
      flush().catch(() => undefined);
    },
    [flush],
  );

  /** A value the server already stored (an uploaded photo): show it, don't send it again. */
  const adopt = useCallback((name: string, value: AnswerValue) => {
    setAnswers((previous) => ({ ...previous, [name]: value }));
  }, []);

  /** flush() for buttons: a failed save shows in `failed`, not as an error here. */
  const saveNow = useCallback(() => {
    flush().catch(() => undefined);
  }, [flush]);

  return {
    answers,
    update,
    flush,
    saveNow,
    adopt,
    dirty,
    saving: save.isPending,
    failed: save.isError && dirty,
  };
}
