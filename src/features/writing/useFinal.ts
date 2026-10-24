import { useState, type SubmitEvent } from 'react';
import { missingFromError, useSubmitWriting } from './api';
import { missingInForm, type FormSpec } from './formSpec';
import type { useDraft } from './useDraft';

/**
 * The final submit of a writing form: checks required answers first (and points at the first
 * one missing through `onMissing`), asks to confirm, then sends every answer. A refusal from the
 * server with missing keys points at them the same way.
 */
export function useFinal(
  spec: FormSpec,
  draft: ReturnType<typeof useDraft>,
  onMissing: (first: { key: string; section: number }) => void,
) {
  const { answers } = draft;
  const submit = useSubmitWriting(spec.type);
  const [confirming, setConfirming] = useState(false);
  const [missing, setMissing] = useState<ReadonlySet<string>>(new Set());
  const [notice, setNotice] = useState(false);
  // Counts refusals, so the page moves focus again even when the same answer is still missing.
  const [attempt, setAttempt] = useState(0);

  // Missing answers show their error until answered.
  const stillMissing: ReadonlySet<string> = new Set(
    missingInForm(spec, answers)
      .map((item) => item.key)
      .filter((key) => missing.has(key)),
  );

  const showMissing = (keys: string[]) => {
    const all = missingInForm(spec, answers);
    const first = all.find((item) => keys.includes(item.key)) ?? all[0];
    if (!first) return;
    setMissing(new Set(keys));
    setNotice(true);
    setAttempt((n) => n + 1);
    onMissing(first);
  };

  const finalize = (event: SubmitEvent) => {
    event.preventDefault();
    const keys = missingInForm(spec, answers).map((item) => item.key);
    if (keys.length) {
      showMissing(keys);
      return;
    }
    setNotice(false);
    setConfirming(true);
  };

  const confirm = async () => {
    try {
      await draft.flush();
    } catch {
      // The final request sends every answer anyway.
    }
    submit.mutate(answers, {
      onError: (error) => {
        setConfirming(false);
        showMissing(missingFromError(error));
      },
    });
  };

  return {
    submit,
    attempt,
    confirming,
    notice,
    stillMissing,
    finalize,
    confirm,
    cancel: () => setConfirming(false),
  };
}
