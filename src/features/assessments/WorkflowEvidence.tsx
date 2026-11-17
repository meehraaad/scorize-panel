import { useId, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { SelectField } from '@/components/ui/Choices';
import { Notice } from '@/components/ui/Notice';
import { SectionCard } from '@/components/ui/SectionCard';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { TextField } from '@/components/ui/TextField';
import { api } from '@/lib/api/client';
import { toast } from '@/lib/toast';
import { documentLinksQuery, sharedFactsQuery } from './calculatorApi';
import { CalculatorForm } from './CalculatorForm';
import { sharedEvidenceSchemas, normalizeSharedEvidence, type Kind } from './sharedEvidenceForms';

interface Evidence {
  id: string;
  revision: number;
  kind: Kind;
  value: unknown;
  status: 'known' | 'unknown';
  confirmed_at: string | null;
  documents: { id: string; document_state: string; review_status: string }[];
}

/** Owned canonical evidence is reusable regardless of the selected countries. */
export function WorkflowEvidence({
  id,
  disabled,
  onChanged,
}: {
  id: string;
  disabled: boolean;
  onChanged: () => void;
}) {
  const { t } = useTranslation('assessments');
  const section = useId();
  const cache = useQueryClient();
  const facts = useQuery(sharedFactsQuery);
  const documents = useQuery(documentLinksQuery(id));
  const [factId, setFactId] = useState('');
  const [documentId, setDocumentId] = useState('');
  const [from, setFrom] = useState('');
  const [until, setUntil] = useState('');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<unknown>();
  const [pending, setPending] = useState<{ path: string; body: Record<string, unknown> } | null>(
    null,
  );
  const mutation = useMutation({
    mutationFn: (request: { path: string; body: Record<string, unknown> }) =>
      api(`/applicant/v1/assessments/shared-evidence/${request.path}`, {
        method: 'POST',
        body: request.body,
      }),
    onSuccess: async () => {
      setPending(null);
      setEditing(false);
      await Promise.all([
        cache.invalidateQueries({ queryKey: sharedFactsQuery.queryKey }),
        cache.invalidateQueries({ queryKey: documentLinksQuery(id).queryKey }),
      ]);
      onChanged();
      toast.success(t('documents.saved'));
    },
    onError: () => toast.error(t('calculator.failed')),
  });
  const rows = (facts.data?.evidence ?? []) as Evidence[];
  const fact = rows.find((row) => row.id === factId);
  const document = documents.data?.documents.find(
    (row) => `${row.source}:${row.id}` === documentId,
  );
  const send = (path: string, body: Record<string, unknown>) => {
    const request = { path, body: { ...body, request_key: crypto.randomUUID() } };
    setPending(request);
    mutation.mutate(request);
  };
  return (
    <SectionCard id={section} title={t('workflow.documents')} variant="panel">
      <p>{t('workflow.documentsMeaning')}</p>
      {(facts.isPending || documents.isPending) && <SkeletonRows rows={2} />}
      {(facts.error || documents.error) && (
        <Notice tone="error">{t('documents.loadFailed')}</Notice>
      )}
      <fieldset disabled={disabled || Boolean(pending)} className="flex flex-col gap-4">
        <SelectField
          label={t('workflow.evidence')}
          value={factId}
          onChange={(value) => {
            setFactId(value);
            setEditing(false);
          }}
          options={[
            { value: '', label: t('workflow.chooseEvidence') },
            ...rows.map((row, index) => ({
              value: row.id,
              label: `${t(`sharedFacts.kinds.${row.kind}`, { defaultValue: t('workflow.evidence') })} · ${index + 1}`,
            })),
          ]}
        />
        {fact && (
          <>
            <Button
              variant="outline"
              onClick={() => {
                setDraft(fact.value);
                setEditing(true);
              }}
            >
              {t('sharedFacts.edit')}
            </Button>
            {!fact.confirmed_at && fact.status === 'known' && (
              <Button
                variant="outline"
                onClick={() =>
                  send('', {
                    action: 'confirm',
                    id: fact.id,
                    revision: fact.revision,
                  })
                }
              >
                {t('sharedFacts.confirm')}
              </Button>
            )}
            {editing && (
              <>
                <Notice tone="warn">{t('workflow.editEvidenceMeaning')}</Notice>
                <CalculatorForm
                  schema={sharedEvidenceSchemas[fact.kind]}
                  field={fact.kind === 'birth_date' ? 'shared_birth_date' : fact.kind}
                  value={draft}
                  onChange={setDraft}
                />
                <Button
                  onClick={() =>
                    send('', {
                      action: 'edit',
                      id: fact.id,
                      revision: fact.revision,
                      status: draft == null ? 'unknown' : 'known',
                      value: normalizeSharedEvidence(fact.kind, draft),
                    })
                  }
                >
                  {t('sharedFacts.saveEdit')}
                </Button>
              </>
            )}
          </>
        )}
        <SelectField
          label={t('documents.choose')}
          value={documentId}
          onChange={setDocumentId}
          options={[
            { value: '', label: t('documents.choosePlaceholder') },
            ...(documents.data?.documents ?? []).map((row) => ({
              value: `${row.source}:${row.id}`,
              label: row.label,
            })),
          ]}
        />
        <TextField
          type="date"
          label={t('sharedFacts.validFrom')}
          value={from}
          onChange={(event) => setFrom(event.target.value)}
        />
        <TextField
          type="date"
          label={t('sharedFacts.validUntil')}
          value={until}
          onChange={(event) => setUntil(event.target.value)}
        />
        <Button
          disabled={!fact?.confirmed_at || !document || Boolean(from && until && from > until)}
          onClick={() => {
            if (fact && document)
              send('documents/', {
                id: fact.id,
                revision: fact.revision,
                document_source: document.source,
                document_id: document.id,
                document_sha256: document.document_sha256,
                valid_from: from || null,
                valid_until: until || null,
              });
          }}
        >
          {t('documents.link')}
        </Button>
        {fact?.documents.map((link) => (
          <div key={link.id} className="flex flex-wrap items-center gap-3">
            <span>
              {t(`documents.state.${link.document_state}`, { defaultValue: t('workflow.review') })}
            </span>
            <span>
              {t(`documents.review.${link.review_status}`, { defaultValue: t('workflow.review') })}
            </span>
            <Button
              variant="outline"
              onClick={() =>
                send('documents/remove/', {
                  id: fact.id,
                  revision: fact.revision,
                  link_id: link.id,
                })
              }
            >
              {t('documents.unlink')}
            </Button>
          </div>
        ))}
      </fieldset>
      {mutation.error && <Notice tone="error">{t('workflow.failed')}</Notice>}
      {pending && !mutation.isPending && (
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => mutation.mutate(pending)}>{t('workflow.retry')}</Button>
          <Button
            variant="outline"
            onClick={() => {
              void facts.refetch().then(() => {
                setPending(null);
                mutation.reset();
                onChanged();
              });
            }}
          >
            {t('workflow.reload')}
          </Button>
        </div>
      )}
    </SectionCard>
  );
}
