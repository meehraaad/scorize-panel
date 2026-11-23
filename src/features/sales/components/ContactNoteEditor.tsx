import { useEffect, useRef, useState, type SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { TextAreaField } from '@/components/ui/TextField';
import { ApiError } from '@/lib/api/client';
import { fieldErrors } from '@/lib/api/fieldErrors';
import { toast } from '@/lib/toast';
import { readContactNote, useEditContactNote, type ContactNote } from '../api/customerMutations';

const MAX_LENGTH = 5_000;

export function ContactNoteEditor({
  customer,
  contact,
  version,
  text,
  onClose,
}: {
  customer: number;
  contact: number;
  version: string;
  text: string;
  /** Cancel, or a successful save. */
  onClose: () => void;
}) {
  const { t } = useTranslation('sales');
  const edit = useEditContactNote(customer, contact);
  const [draft, setDraft] = useState<ContactNote>({ notes: text, version });
  const [review, setReview] = useState<ContactNote | 'reload' | null>(null);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const field = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const textarea = field.current;
    if (!textarea) return;
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
  }, []);

  async function loadCurrentNote() {
    setReview('reload');
    try {
      setReview(await readContactNote(customer, contact));
    } catch {
      toast.error(t('customer.history.edit.reloadFailed'));
    }
  }

  async function save(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (review || inFlight.current) return;
    const notes = draft.notes.trim();
    if (Array.from(notes).length > MAX_LENGTH) {
      setError(t('customer.history.edit.tooLong'));
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setError(undefined);
    try {
      await edit.mutateAsync({ ...draft, notes });
      toast.success(t('customer.history.edit.saved'));
      onClose();
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 409) {
        await loadCurrentNote();
      } else {
        setError(fieldErrors(failure).notes);
        toast.error(t('customer.history.edit.failed'));
      }
    } finally {
      setBusy(false);
      inFlight.current = false;
    }
  }

  return (
    <form
      onSubmit={(event) => void save(event)}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !busy) {
          event.stopPropagation();
          onClose();
        }
      }}
      className="flex min-w-0 flex-col gap-2"
    >
      <TextAreaField
        ref={field}
        label={t('customer.logDialog.notes')}
        rows={3}
        value={draft.notes}
        onChange={(event) => {
          setDraft({ ...draft, notes: event.target.value });
          setError(undefined);
        }}
        error={error}
        disabled={busy}
      />
      {review && (
        <div className="rounded-xl bg-info-tint p-3 text-sm">
          <p role="status" className="m-0">
            {t('customer.history.edit.conflict')}
          </p>
          {review === 'reload' ? (
            <Button
              type="button"
              variant="quiet"
              disabled={busy}
              onClick={() => {
                if (inFlight.current) return;
                inFlight.current = true;
                setBusy(true);
                void loadCurrentNote().finally(() => {
                  inFlight.current = false;
                  setBusy(false);
                });
              }}
            >
              {t('customer.history.edit.reload')}
            </Button>
          ) : (
            <>
              <p className="my-2 break-words whitespace-pre-wrap">
                {review.notes || t('customer.history.edit.empty')}
              </p>
              <Button
                type="button"
                variant="quiet"
                onClick={() => {
                  setDraft({ ...draft, version: review.version });
                  setReview(null);
                }}
              >
                {t('customer.history.edit.reviewed')}
              </Button>
            </>
          )}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy || review !== null}>
          {t('customer.history.edit.save')}
        </Button>
        <Button type="button" variant="quiet" disabled={busy} onClick={onClose}>
          {t('customer.history.edit.cancel')}
        </Button>
      </div>
    </form>
  );
}
