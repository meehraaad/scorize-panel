import { useRef, useState, type SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
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
}: {
  customer: number;
  contact: number;
  version: string;
  text: string;
}) {
  const { t } = useTranslation('sales');
  const edit = useEditContactNote(customer, contact);
  const [draft, setDraft] = useState<ContactNote | null>(null);
  const [review, setReview] = useState<ContactNote | 'reload' | null>(null);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

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
    if (!draft || review || inFlight.current) return;
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
      setDraft(null);
      toast.success(t('customer.history.edit.saved'));
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

  if (!draft) {
    return (
      <div className="flex flex-wrap items-center gap-x-2">
        {text && <p className="m-0 text-sm leading-7 break-words whitespace-pre-wrap">{text}</p>}
        <Button
          variant="quiet"
          type="button"
          className="min-h-11 px-2"
          aria-label={t('customer.history.edit.label')}
          onClick={() => setDraft({ notes: text, version })}
        >
          <Icon name="pen" size={16} />
          {t('customer.history.edit.action')}
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={(event) => void save(event)} className="flex min-w-0 flex-col gap-2">
      <TextAreaField
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
        <Button
          type="button"
          variant="quiet"
          disabled={busy}
          onClick={() => {
            setDraft(null);
            setReview(null);
            setError(undefined);
          }}
        >
          {t('customer.history.edit.cancel')}
        </Button>
      </div>
    </form>
  );
}
