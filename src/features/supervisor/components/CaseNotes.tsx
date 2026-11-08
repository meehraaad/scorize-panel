import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { TextAreaField } from '@/components/ui/TextField';
import { SectionCard } from '@/components/ui/SectionCard';
import { toast } from '@/lib/toast';
import { useSaveNote, type CaseData, type CaseNoteKind } from '../api';

/**
 * The case's two internal notes (supervisor, executive manager), only for the company's staff: the
 * applicant never sees them. Each opens in place to edit; the manager note only for managers.
 */
export function CaseNotes({ data }: { data: CaseData }) {
  const { t } = useTranslation('supervisor');
  return (
    <SectionCard id="case-notes" variant="panel" title={t('overview.notes.title')}>
      <p className="m-0 text-[13px] leading-6 text-text-2">{t('overview.notes.private')}</p>
      <Note caseId={data.id} kind="supervisor" text={data.notes.supervisor} editable />
      <Note
        caseId={data.id}
        kind="manager"
        text={data.notes.manager}
        editable={data.notes.manager_editable}
      />
    </SectionCard>
  );
}

function Note({
  caseId,
  kind,
  text,
  editable,
}: {
  caseId: number;
  kind: CaseNoteKind;
  text: string;
  editable: boolean;
}) {
  const { t } = useTranslation('supervisor');
  const save = useSaveNote(caseId);
  const [draft, setDraft] = useState<string | null>(null);
  const label = t(`overview.notes.${kind}`);

  if (draft !== null) {
    return (
      <div className="flex flex-col gap-3">
        <TextAreaField
          label={label}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          maxLength={5000}
          rows={4}
          autoFocus
        />
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={save.isPending || draft.trim() === text}
            onClick={() =>
              save.mutate(
                { kind, text: draft.trim() },
                {
                  onError: () => toast.error(t('saveError')),
                  onSuccess: () => {
                    toast.success(t('overview.notes.saved'));
                    setDraft(null);
                  },
                },
              )
            }
          >
            {t('overview.notes.save')}
          </Button>
          <Button variant="outline" onClick={() => setDraft(null)}>
            {t('cancel')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5 not-first:pt-1">
      <div className="flex items-center justify-between gap-2">
        <h3 className="m-0 text-[15px] font-semibold">{label}</h3>
        {editable && (
          <Button
            variant="outline"
            className="h-11 px-4 text-sm"
            aria-label={t('overview.notes.editLabel', { note: label })}
            onClick={() => setDraft(text)}
          >
            {t(text ? 'overview.notes.edit' : 'overview.notes.add')}
          </Button>
        )}
      </div>
      {text ? (
        <p className="m-0 text-[15px] leading-7 break-words whitespace-pre-wrap">{text}</p>
      ) : (
        <p className="m-0 text-[15px] leading-7 text-text-2">{t('overview.notes.empty')}</p>
      )}
    </div>
  );
}
