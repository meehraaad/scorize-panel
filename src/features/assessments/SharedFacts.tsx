import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { SelectField } from '@/components/ui/Choices';
import { Notice } from '@/components/ui/Notice';
import { SectionCard } from '@/components/ui/SectionCard';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { TextField } from '@/components/ui/TextField';
import { api } from '@/lib/api/client';
import { toast } from '@/lib/toast';
import { CalculatorForm } from './CalculatorForm';
import { documentLinksQuery, type Country } from './calculatorApi';

import {
  sharedEvidenceSchemas as schema,
  normalizeSharedEvidence as normalized,
  type Kind,
} from './sharedEvidenceForms';
export type FactRef = { id: string; revision: number };
type Fact = FactRef & {
  kind: Kind;
  status: 'known' | 'unknown';
  value: unknown;
  confirmed_at: string | null;
  documents: {
    id: string;
    document_id: number;
    document_source: string;
    document_state: 'current' | 'missing' | 'replaced' | 'unresolved';
    review_status: 'unreviewed' | 'review' | 'approved' | 'returned' | 'unresolved';
    valid_from: string | null;
    valid_until: string | null;
  }[];
};
const url = '/applicant/v1/assessments/shared-evidence/';

export function SharedFacts({
  id,
  country,
  disabled,
  assessmentDate,
  onPrepare,
}: {
  id: string;
  country: Country;
  disabled: boolean;
  assessmentDate?: string | undefined;
  onPrepare: (field: string, value: unknown, refs: FactRef[]) => void;
}) {
  const { t } = useTranslation('assessments');
  const sectionId = useId();
  const cache = useQueryClient();
  const query = useQuery({
    queryKey: ['shared-assessment-evidence'],
    queryFn: () => api<{ evidence: Fact[] }>(url),
  });
  const docs = useQuery(documentLinksQuery(id));
  const labels = t('calculator.fields', { returnObjects: true }) as Record<string, string>;
  const choices = t('calculator.choices', { returnObjects: true }) as Record<string, string>;
  const [kind, setKind] = useState<Kind>('birth_date');
  const [value, setValue] = useState<unknown>();
  const [editing, setEditing] = useState<Fact | null>(null);
  const [pending, setPending] = useState<Record<string, unknown> | null>(null);
  const [selectedJobs, setSelectedJobs] = useState<string[]>([]);
  const [selectedDoc, setSelectedDoc] = useState('');
  const [validFrom, setValidFrom] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [pendingDoc, setPendingDoc] = useState<{
    path: string;
    body: Record<string, unknown>;
  } | null>(null);
  const mutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api(url, { method: 'POST', body }),
    onSuccess: () => {
      setPending(null);
      setEditing(null);
      setValue(undefined);
      void cache.invalidateQueries({ queryKey: ['shared-assessment-evidence'] });
      void cache.invalidateQueries({ queryKey: ['calculator-interview'] });
      toast.success(t('calculator.saved'));
    },
    onError: () => toast.error(t('calculator.failed')),
  });
  const send = (body: Record<string, unknown>) => {
    const request = pending ?? { ...body, request_key: crypto.randomUUID() };
    setPending(request);
    mutation.mutate(request);
  };
  const docMutation = useMutation({
    mutationFn: ({ path, body }: { path: string; body: Record<string, unknown> }) =>
      api(url + path, { method: 'POST', body }),
    onSuccess: () => {
      setPendingDoc(null);
      void cache.invalidateQueries({ queryKey: ['shared-assessment-evidence'] });
      void cache.invalidateQueries({ queryKey: ['calculator-interview'] });
      void cache.invalidateQueries({ queryKey: ['calculator-snapshots'] });
      toast.success(t('documents.saved'));
    },
    onError: () => toast.error(t('calculator.failed')),
  });
  const sendDoc = (path: string, body: Record<string, unknown>) => {
    const request = { path, body: { ...body, request_key: crypto.randomUUID() } };
    setPendingDoc(request);
    docMutation.mutate(request);
  };
  const facts = query.data?.evidence ?? [];
  const jobs = facts.filter(
    (item) => item.kind === 'employment' && item.confirmed_at && selectedJobs.includes(item.id),
  );
  const doc = docs.data?.documents.find((item) => `${item.source}:${item.id}` === selectedDoc);
  const details = (value: unknown): React.ReactNode => {
    if (value == null) return t('calculator.unknown');
    if (typeof value === 'boolean') return t(value ? 'yes' : 'no');
    if (typeof value === 'string' || typeof value === 'number')
      return choices[String(value)] ?? String(value);
    if (typeof value === 'object' && !Array.isArray(value))
      return (
        <dl>
          {Object.entries(value).map(([key, val]) => (
            <div key={key} className="flex flex-wrap gap-2">
              <dt>{labels[key] ?? t('calculator.unknown')}</dt>
              <dd className="m-0">
                <bdi>{details(val)}</bdi>
              </dd>
            </div>
          ))}
        </dl>
      );
    return t('calculator.unknown');
  };
  return (
    <SectionCard id={sectionId} title={t('sharedFacts.title')} variant="panel">
      <div className="flex flex-col gap-4">
        <p>{t('sharedFacts.description')}</p>
        {query.isPending && <SkeletonRows rows={2} />}
        {query.error && <Notice tone="error">{t('calculator.failed')}</Notice>}
        <SelectField
          label={t('sharedFacts.kind')}
          value={kind}
          options={(['birth_date', 'language', 'employment'] as const).map((k) => ({
            value: k,
            label: t(`sharedFacts.kinds.${k}`),
          }))}
          disabled={disabled || mutation.isPending || Boolean(pending)}
          onChange={(v) => {
            setKind(v);
            setEditing(null);
            setValue(undefined);
          }}
        />
        <CalculatorForm
          schema={schema[kind]}
          field={kind === 'birth_date' ? 'shared_birth_date' : kind}
          value={value}
          onChange={setValue}
        />
        <Button
          disabled={disabled || mutation.isPending}
          onClick={() =>
            send({
              action: editing ? 'edit' : 'create',
              ...(editing ? { id: editing.id, revision: editing.revision } : { kind, revision: 0 }),
              status: value == null ? 'unknown' : 'known',
              value: value == null ? null : normalized(kind, value),
            })
          }
        >
          {t(
            pending ? 'sharedFacts.retry' : editing ? 'sharedFacts.saveEdit' : 'sharedFacts.create',
          )}
        </Button>
        {pending && (
          <Button
            variant="outline"
            onClick={() => {
              setPending(null);
              mutation.reset();
            }}
          >
            {t('sharedFacts.discardRetry')}
          </Button>
        )}
        <SelectField
          label={t('documents.choose')}
          value={selectedDoc}
          disabled={disabled || Boolean(pendingDoc)}
          options={[
            { value: '', label: t('documents.choosePlaceholder') },
            ...(docs.data?.documents ?? []).map((item) => ({
              value: `${item.source}:${item.id}`,
              label: item.label,
            })),
          ]}
          onChange={setSelectedDoc}
        />
        <TextField
          type="date"
          label={t('sharedFacts.validFrom')}
          value={validFrom}
          disabled={disabled || Boolean(pendingDoc)}
          onChange={(event) => setValidFrom(event.target.value)}
        />
        <TextField
          type="date"
          label={t('sharedFacts.validUntil')}
          value={validUntil}
          disabled={disabled || Boolean(pendingDoc)}
          onChange={(event) => setValidUntil(event.target.value)}
        />
        {docs.error && <Notice tone="error">{t('documents.loadFailed')}</Notice>}
        {pendingDoc && (
          <>
            <Button disabled={docMutation.isPending} onClick={() => docMutation.mutate(pendingDoc)}>
              {t('sharedFacts.retry')}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setPendingDoc(null);
                docMutation.reset();
              }}
            >
              {t('sharedFacts.discardRetry')}
            </Button>
          </>
        )}
        {facts.map((item) => (
          <article key={item.id} className="border-line flex flex-col gap-2 rounded-xl border p-3">
            <h3>{t(`sharedFacts.kinds.${item.kind}`)}</h3>
            <div>{details(item.value)}</div>
            <p>
              {t(
                item.status === 'unknown'
                  ? 'sharedFacts.unknown'
                  : item.confirmed_at
                    ? 'sharedFacts.confirmed'
                    : 'sharedFacts.unconfirmed',
              )}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                disabled={disabled || mutation.isPending || Boolean(pending)}
                onClick={() => {
                  setKind(item.kind);
                  setEditing(item);
                  setValue(item.value ?? undefined);
                }}
              >
                {t('sharedFacts.edit')}
              </Button>
              {item.status === 'known' && !item.confirmed_at && (
                <Button
                  variant="outline"
                  disabled={disabled || mutation.isPending || Boolean(pending)}
                  onClick={() => send({ action: 'confirm', id: item.id, revision: item.revision })}
                >
                  {t('sharedFacts.confirm')}
                </Button>
              )}
              {item.confirmed_at && item.kind !== 'employment' && (
                <Button
                  variant="outline"
                  disabled={disabled || mutation.isPending || Boolean(pending)}
                  onClick={() => {
                    if (item.kind === 'birth_date')
                      onPrepare(
                        country === 'canada' ? 'birth_date' : 'facts.birth_date',
                        item.value,
                        [item],
                      );
                    else {
                      const report = item.value as Record<string, unknown>;
                      const field =
                        country === 'canada' &&
                        ['tcf_canada', 'tef_canada'].includes(String(report.test))
                          ? 'french'
                          : 'english';
                      const projected =
                        country === 'canada'
                          ? { test: report.test, scores: report.scores, result_date: report.date }
                          : {
                              test: report.test,
                              scores: report.scores,
                              test_date: report.date,
                              in_test_centre: report.in_test_centre,
                              one_skill_retake: report.one_skill_retake,
                            };
                      onPrepare(field, projected, [item]);
                    }
                  }}
                >
                  {t('sharedFacts.select')}
                </Button>
              )}
              {item.confirmed_at && item.kind === 'employment' && (
                <label className="flex min-h-11 items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedJobs.includes(item.id)}
                    onChange={(e) =>
                      setSelectedJobs((ids) =>
                        e.target.checked ? [...ids, item.id] : ids.filter((id) => id !== item.id),
                      )
                    }
                  />
                  {t('sharedFacts.selectJob')}
                </label>
              )}
              {item.confirmed_at && (
                <Button
                  variant="outline"
                  disabled={
                    disabled ||
                    !doc ||
                    Boolean(pendingDoc) ||
                    docMutation.isPending ||
                    Boolean(validFrom && validUntil && validFrom > validUntil)
                  }
                  onClick={() => {
                    if (doc)
                      sendDoc('documents/', {
                        id: item.id,
                        revision: item.revision,
                        document_source: doc.source,
                        document_id: doc.id,
                        document_sha256: doc.document_sha256,
                        valid_from: validFrom || null,
                        valid_until: validUntil || null,
                      });
                  }}
                >
                  {t('documents.link')}
                </Button>
              )}
            </div>
            {item.documents.map((link) => (
              <div key={link.id} className="flex flex-wrap items-center gap-2">
                <span>{t(`documents.state.${link.document_state}`)}</span>
                <span>{t(`documents.review.${link.review_status}`)}</span>
                <span>
                  {t(
                    !link.valid_from || !link.valid_until || !assessmentDate
                      ? 'documents.dates.unknown'
                      : assessmentDate < link.valid_from
                        ? 'documents.dates.not_yet_valid'
                        : assessmentDate > link.valid_until
                          ? 'documents.dates.expired'
                          : 'documents.dates.within_stated_dates',
                  )}
                </span>
                <Button
                  variant="outline"
                  disabled={disabled || Boolean(pendingDoc) || docMutation.isPending}
                  onClick={() =>
                    sendDoc('documents/remove/', {
                      id: item.id,
                      revision: item.revision,
                      link_id: link.id,
                    })
                  }
                >
                  {t('documents.unlink')}
                </Button>
              </div>
            ))}
          </article>
        ))}
        {jobs.length > 0 && (
          <Button
            variant="outline"
            disabled={disabled}
            onClick={() =>
              onPrepare(
                'work',
                jobs.map((job) => job.value),
                jobs,
              )
            }
          >
            {t('sharedFacts.useJobs')}
          </Button>
        )}
      </div>
    </SectionCard>
  );
}
