import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { SelectField } from '@/components/ui/Choices';
import { Notice } from '@/components/ui/Notice';
import { SectionCard } from '@/components/ui/SectionCard';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { TextField } from '@/components/ui/TextField';
import { toast } from '@/lib/toast';
import { documentLinksQuery, saveDocumentLink, type Country } from './calculatorApi';

export function DocumentLinks({
  id,
  country,
  field,
  factId,
  known,
  revision,
  disabled,
  onBusy,
}: {
  id: string;
  country: Country;
  field: string;
  factId: string;
  known: boolean;
  revision: number;
  disabled: boolean;
  onBusy: (busy: boolean) => void;
}) {
  const { t } = useTranslation('assessments');
  const sectionId = useId();
  const cache = useQueryClient();
  const query = useQuery(documentLinksQuery(id));
  const documentRevision = query.data?.revision;
  useEffect(() => {
    if (documentRevision !== undefined && documentRevision !== revision) {
      void cache.invalidateQueries({ queryKey: documentLinksQuery(id).queryKey });
    }
  }, [cache, id, revision, documentRevision]);
  const outdated = query.data?.revision !== revision;
  const [selected, setSelected] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [pending, setPending] = useState<Record<string, unknown> | null>(null);
  const mutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => saveDocumentLink(id, body),
    onSuccess: async (result) => {
      cache.setQueryData(documentLinksQuery(id).queryKey, result);
      await Promise.all(
        [
          'calculator-interview',
          'calculator-guidance',
          'calculator-comparison',
          'calculator-snapshots',
        ].map((key) => cache.invalidateQueries({ queryKey: [key, id] })),
      );
      setPending(null);
      onBusy(false);
      toast.success(t('documents.saved'));
    },
  });
  const send = (body: Record<string, unknown>) => {
    setPending(body);
    onBusy(true);
    mutation.mutate(body);
  };
  const doc = query.data?.documents.find((item) => `${item.source}:${item.id}` === selected);
  const links = query.data?.links.filter((item) => item.fact_id === factId) ?? [];
  return (
    <SectionCard id={sectionId} title={t('documents.title')} variant="panel">
      <div className="flex flex-col gap-3">
        <p>{t('documents.explanation')}</p>
        {query.isPending && <SkeletonRows rows={2} />}
        {query.error && (
          <>
            <Notice tone="error">{t('documents.loadFailed')}</Notice>
            <Button
              variant="outline"
              onClick={() => {
                void query.refetch();
              }}
            >
              {t('documents.reload')}
            </Button>
          </>
        )}
        {query.data && query.data.documents.length === 0 && <p>{t('documents.empty')}</p>}
        {query.data && query.data.documents.length > 0 && (
          <>
            <SelectField
              label={t('documents.choose')}
              value={selected}
              disabled={disabled || outdated || Boolean(pending)}
              options={[
                { value: '', label: t('documents.choosePlaceholder') },
                ...query.data.documents.map((item) => ({
                  value: `${item.source}:${item.id}`,
                  label: `${item.label} — ${t(`documents.source.${item.source}`)}`,
                })),
              ]}
              onChange={setSelected}
            />
            <TextField
              type="date"
              label={t('documents.validFrom')}
              value={start}
              disabled={disabled || outdated || Boolean(pending)}
              onChange={(e) => setStart(e.target.value)}
            />
            <TextField
              type="date"
              label={t('documents.validUntil')}
              value={end}
              disabled={disabled || outdated || Boolean(pending)}
              onChange={(e) => setEnd(e.target.value)}
            />
            {!known && <p>{t('documents.saveFactFirst')}</p>}
            <Button
              disabled={
                disabled ||
                outdated ||
                Boolean(pending) ||
                !doc ||
                !known ||
                Boolean(start && end && start > end)
              }
              onClick={() => {
                if (!doc) return;
                send({
                  action: 'link',
                  revision: query.data.revision,
                  request_key: crypto.randomUUID(),
                  country,
                  field,
                  document_source: doc.source,
                  document_id: doc.id,
                  document_sha256: doc.document_sha256,
                  valid_from: start || null,
                  valid_until: end || null,
                });
              }}
            >
              {t('documents.link')}
            </Button>
          </>
        )}
        {links.map((link) => (
          <div key={link.id} className="border-line flex flex-col gap-2 rounded-xl border p-3">
            <p>{link.document_label}</p>
            <p>
              {t(`documents.state.${link.document_state}`, {
                defaultValue: t('documents.state.unresolved'),
              })}
            </p>
            <p>
              {t(`documents.dates.${link.date_state}`, {
                defaultValue: t('documents.dates.unknown'),
              })}
            </p>
            {link.fact_state !== 'current' && (
              <Notice tone="warn">{t('documents.factChanged')}</Notice>
            )}
            {link.review_changed && <Notice tone="warn">{t('documents.reviewChanged')}</Notice>}
            <p>
              {t(`documents.review.${link.review_status}`, {
                defaultValue: t('documents.review.unresolved'),
              })}
            </p>
            <Button
              variant="outline"
              aria-label={t('documents.unlinkFor', { document: link.document_label })}
              disabled={disabled || outdated || Boolean(pending)}
              onClick={() =>
                query.data &&
                send({
                  action: 'unlink',
                  revision: query.data.revision,
                  request_key: crypto.randomUUID(),
                  link_id: link.id,
                })
              }
            >
              {t('documents.unlink')}
            </Button>
          </div>
        ))}
        {mutation.isError && pending && <Notice tone="error">{t('documents.saveFailed')}</Notice>}
        {mutation.isError && pending && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => mutation.mutate(pending)}>
              {t('documents.retry')}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                void Promise.all([
                  query.refetch(),
                  cache.invalidateQueries({ queryKey: ['calculator-interview', id] }),
                ]).then(() => {
                  setPending(null);
                  onBusy(false);
                  mutation.reset();
                });
              }}
            >
              {t('documents.discard')}
            </Button>
          </div>
        )}
      </div>
    </SectionCard>
  );
}
