import { useSuspenseQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { TextAreaField } from '@/components/ui/Choices';
import { EmptyState } from '@/components/ui/EmptyState';
import { FileTile } from '@/components/ui/Files';
import { Icon } from '@/components/ui/Icon';
import { Notice } from '@/components/ui/Notice';
import { PageColumns } from '@/components/ui/PageColumns';
import { ProgressBar } from '@/components/ui/Progress';
import { SectionCard } from '@/components/ui/SectionCard';
import { TagList } from '@/components/ui/Tags';
import { useFormat } from '@/lib/i18n/useFormat';
import { percentOf } from '@/lib/progress';
import { safeHref } from '@/lib/url';
import { documentsQuery, useReviewDocument, type CaseDocument, type CaseWriting } from './api';
import { DocumentChip } from './components/Chips';
import { RequestDocumentDialog } from './components/RequestDocumentDialog';
import { useCaseId } from './useCaseId';

/**
 * What the applicant was asked for and what they sent: check each upload (accept, or send it back
 * with a reason they will see), ask for another document; the writing orders and research
 * interests the professor-email bot searches with. Canvas V1 "پرونده و مدارک".
 */
export default function CaseDocumentsPage() {
  const { t } = useTranslation('supervisor');
  const id = useCaseId();
  const { data } = useSuspenseQuery(documentsQuery(id));
  return (
    <PageColumns
      asideLabel={t('documents.aside')}
      main={
        <>
          <Documents caseId={id} documents={data.documents} />
          {data.writing && <Writing orders={data.writing} />}
        </>
      }
      aside={
        <SectionCard id="case-interests" variant="panel" title={t('documents.interests.title')}>
          {data.interests.length === 0 ? (
            <p className="m-0 text-[15px] leading-7 text-text-2">
              {t('documents.interests.empty')}
            </p>
          ) : (
            <TagList label={t('documents.interests.title')} tags={data.interests} />
          )}
          <p className="m-0 text-[13px] leading-6 text-text-2">{t('documents.interests.hint')}</p>
        </SectionCard>
      }
    />
  );
}

function Documents({ caseId, documents }: { caseId: number; documents: CaseDocument[] }) {
  const { t } = useTranslation('supervisor');
  const f = useFormat();
  const [asking, setAsking] = useState(false);
  const done = documents.filter((doc) => doc.state === 'approved' || doc.state === 'review').length;
  // Uploads to check come first, then what is still missing.
  const ORDER = { review: 0, returned: 1, missing: 2, approved: 3 } as const;
  const sorted = documents.toSorted((a, b) => ORDER[a.state] - ORDER[b.state]);

  return (
    <SectionCard
      id="case-documents"
      title={t('documents.title')}
      subtitle={t('documents.subtitle', {
        done: f.number(done),
        total: f.number(documents.length),
      })}
      end={
        <Button variant="outline" className="h-11 px-4 text-sm" onClick={() => setAsking(true)}>
          <Icon name="plus" size={16} />
          {t('documents.request')}
        </Button>
      }
    >
      <div className="px-5 pb-2 lg:px-8">
        <ProgressBar
          value={percentOf(done, documents.length)}
          tone={done >= documents.length ? 'good' : 'primary'}
        />
      </div>
      {documents.length === 0 ? (
        <EmptyState>{t('documents.empty')}</EmptyState>
      ) : (
        <ul className="m-0 list-none p-0 pb-2">
          {sorted.map((doc) => (
            <DocumentRow key={doc.id} caseId={caseId} doc={doc} />
          ))}
        </ul>
      )}
      <RequestDocumentDialog
        key={asking ? 'ask-open' : 'ask-closed'}
        caseId={caseId}
        open={asking}
        onClose={() => setAsking(false)}
      />
    </SectionCard>
  );
}

function DocumentRow({ caseId, doc }: { caseId: number; doc: CaseDocument }) {
  const { t } = useTranslation('supervisor');
  const f = useFormat();
  const review = useReviewDocument(caseId);
  const [returning, setReturning] = useState(false);
  const [note, setNote] = useState('');

  return (
    <li
      className={`flex flex-col gap-3 px-5 py-4 shadow-[inset_0_1px_0_var(--hair)] lg:px-8 ${
        doc.state === 'review' ? 'bg-row-highlight' : ''
      }`}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        <span className="flex-[1_1_200px] text-[15px] font-semibold">{doc.name}</span>
        <DocumentChip state={doc.state} />
        {doc.deadline && doc.state !== 'approved' && (
          <span className="text-[13px] text-text-2">
            {t('documents.deadline', { date: f.date(doc.deadline) })}
          </span>
        )}
      </div>
      {doc.file && (
        <FileTile
          ext={doc.file.ext}
          name={doc.file.name}
          href={doc.file.url}
          meta={t('documents.uploaded', { when: f.timeAgo(doc.file.uploaded_at) })}
        />
      )}
      {doc.state === 'returned' && doc.note && (
        <p className="m-0 text-sm leading-6 text-danger">
          {t('documents.returnedNote', { note: doc.note })}
        </p>
      )}
      {review.isError && <Notice tone="error">{t('saveError')}</Notice>}
      {doc.state === 'review' &&
        (returning ? (
          <div className="flex flex-col gap-3 rounded-2xl bg-surface p-4 shadow-[inset_0_0_0_1px_var(--line-2)]">
            <TextAreaField
              label={t('documents.returnReason')}
              hint={t('documents.returnHint')}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={2}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                variant="danger"
                className="shadow-[inset_0_0_0_1px_var(--danger)]"
                disabled={!note.trim() || review.isPending}
                onClick={() =>
                  review.mutate({ document: doc.id, approved: false, note: note.trim() })
                }
              >
                {t('documents.returnConfirm')}
              </Button>
              <Button variant="outline" onClick={() => setReturning(false)}>
                {t('cancel')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={review.isPending}
              onClick={() => review.mutate({ document: doc.id, approved: true, note: '' })}
              aria-label={t('documents.approveLabel', { name: doc.name })}
            >
              <Icon name="check" size={18} />
              {t('documents.approve')}
            </Button>
            <Button
              variant="outline"
              disabled={review.isPending}
              onClick={() => setReturning(true)}
              aria-label={t('documents.returnLabel', { name: doc.name })}
            >
              {t('documents.return')}
            </Button>
          </div>
        ))}
    </li>
  );
}

function Writing({ orders }: { orders: CaseWriting[] }) {
  const { t } = useTranslation('supervisor');
  const f = useFormat();
  const TONE = { form: 'warn', writing: 'info', ready: 'good' } as const;
  return (
    <SectionCard id="case-writing" title={t('documents.writing.title')}>
      <ul className="m-0 list-none p-0 pb-2">
        {orders.map((order) => (
          <li
            key={order.type}
            className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-5 py-4 shadow-[inset_0_1px_0_var(--hair)] lg:px-8"
          >
            <span className="flex-[1_1_160px] text-[15px] font-semibold">
              {t(`writingType.${order.type}`)}
            </span>
            <Chip tone={TONE[order.step]} small>
              {t(`documents.writing.step.${order.step}`)}
            </Chip>
            <span className="flex-[1_1_160px] text-sm text-text-2">
              {order.writer
                ? t('documents.writing.writer', { name: order.writer })
                : t('documents.writing.noWriter')}
            </span>
            {order.file_url && order.delivered_at && (
              <a
                href={safeHref(order.file_url)}
                target="_blank"
                rel="noopener"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-text hover:underline"
              >
                <Icon name="download" size={16} />
                {t('documents.writing.file', { date: f.date(order.delivered_at) })}
              </a>
            )}
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}
