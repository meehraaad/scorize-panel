import { useIsMutating } from '@tanstack/react-query';
import { useRef, useState, type SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { toast } from '@/lib/toast';
import {
  missingFromError,
  paymentFromError,
  receiptInReview,
  useSubmitWriting,
  writingKey,
} from './api';
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
  const { t } = useTranslation('writing');
  const { answers } = draft;
  const submit = useSubmitWriting(spec.type);
  const navigate = useNavigate();
  const uploading = useIsMutating({ mutationKey: [...writingKey(spec.type), 'photo'] }) > 0;
  const lock = useRef(false);
  const [pending, setPending] = useState(false);
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
    const all = missingInForm(spec, draft.getAnswers());
    const first = all.find((item) => keys.includes(item.key)) ?? all[0];
    if (!first) return;
    setMissing(new Set(keys));
    setNotice(true);
    setAttempt((n) => n + 1);
    onMissing(first);
  };

  const finalize = (event: Pick<SubmitEvent, 'preventDefault'>) => {
    event.preventDefault();
    if (lock.current || uploading) return;
    const keys = missingInForm(spec, draft.getAnswers()).map((item) => item.key);
    if (keys.length) {
      showMissing(keys);
      return;
    }
    setNotice(false);
    setConfirming(true);
  };

  const confirm = async () => {
    if (lock.current || uploading || !confirming) return;
    lock.current = true;
    setPending(true);
    try {
      try {
        await draft.flush();
      } catch {
        toast.error(t('final.draftError'));
        setConfirming(false);
        return;
      }
      const latest = draft.getAnswers();
      const keys = missingInForm(spec, latest).map((item) => item.key);
      if (keys.length) {
        setConfirming(false);
        showMissing(keys);
        return;
      }
      await submit.mutateAsync(latest);
    } catch (error) {
      setConfirming(false);
      const keys = missingFromError(error);
      const payment = paymentFromError(error);
      if (keys.length) showMissing(keys);
      else if (payment !== null) {
        toast.success(t('final.toPay'));
        void navigate(`/payments/${payment}`);
      } else if (receiptInReview(error)) toast.error(t('final.inReview'));
      else toast.error(t('final.error'));
    } finally {
      lock.current = false;
      setPending(false);
    }
  };

  return {
    submit,
    pending,
    uploading,
    attempt,
    confirming,
    notice,
    stillMissing,
    finalize,
    confirm,
    cancel: () => setConfirming(false),
  };
}
