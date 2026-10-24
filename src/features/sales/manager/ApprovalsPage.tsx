import { useSuspenseQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router';
import { Button } from '@/components/ui/Button';
import { buttonClass } from '@/components/ui/buttonStyles';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { TextAreaField } from '@/components/ui/Choices';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import { Notice } from '@/components/ui/Notice';
import { PageColumns } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import { useFormat } from '@/lib/i18n/useFormat';
import { approvalsQuery, useDecideDraft, type ApprovalAction, type ContractDraft } from '../api';
import { customerPath } from '../paths';

/** Contract drafts waiting for the sales manager. Canvas "تأیید قراردادها". */
export default function ApprovalsPage() {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const { data } = useSuspenseQuery(approvalsQuery);
  const [params, setParams] = useSearchParams();
  const current =
    data.drafts.find((draft) => String(draft.id) === params.get('draft')) ?? data.drafts[0];

  return (
    <>
      <PageHeader
        title={
          data.drafts.length
            ? t('manager.approvals.title', { n: f.number(data.drafts.length) })
            : t('manager.approvals.titleNone')
        }
        subtitle={t('manager.approvals.subtitle')}
      />
      {!current ? (
        <EmptyState variant="card">{t('manager.approvals.empty')}</EmptyState>
      ) : (
        <PageColumns
          asideLabel={t('manager.approvals.list')}
          asideWidth="sm"
          main={<DraftDetail key={current.id} draft={current} />}
          aside={
            <Card aria-label={t('manager.approvals.list')}>
              <ul className="m-0 list-none p-0">
                {data.drafts.map((draft) => (
                  <li
                    key={draft.id}
                    className="shadow-[inset_0_1px_0_var(--hair)] first:shadow-none"
                  >
                    <button
                      type="button"
                      aria-pressed={draft.id === current.id}
                      onClick={() =>
                        setParams(
                          (search) => {
                            search.set('draft', String(draft.id));
                            return search;
                          },
                          { replace: true },
                        )
                      }
                      className="flex w-full flex-col gap-1.5 px-5 py-4 text-start hover:bg-canvas aria-pressed:bg-row-highlight"
                    >
                      <span className="flex justify-between gap-2">
                        <span className="text-[15px] font-semibold">{draft.name}</span>
                        <span className="text-xs text-text-2">{f.timeAgo(draft.created_at)}</span>
                      </span>
                      <span className="text-[13px] text-text-2">{draft.summary}</span>
                      <span className="flex flex-wrap gap-1.5">
                        <Chip tone="neutral" small>
                          {draft.seller}
                        </Chip>
                        {draft.discount > 0 && (
                          <Chip tone="warn" small>
                            {t('manager.approvals.discount', { n: f.number(draft.discount) })}
                          </Chip>
                        )}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          }
        />
      )}
    </>
  );
}

function DraftDetail({ draft }: { draft: ContractDraft }) {
  const { t } = useTranslation('sales');
  const decide = useDecideDraft();
  const [comment, setComment] = useState('');
  const [tried, setTried] = useState(false);

  const act = (action: ApprovalAction) => {
    setTried(true);
    // Returning or rejecting needs a word for the seller.
    if (action !== 'approve' && !comment.trim()) return;
    decide.mutate({ id: draft.id, action, comment: comment.trim() });
  };

  return (
    <Card aria-labelledby="draft-title" className="flex flex-col gap-6 p-5 lg:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="draft-title" className="m-0 font-display text-xl font-bold">
            {draft.name}
          </h2>
          <span className="text-sm text-text-2">{draft.meta}</span>
        </div>
        <Link to={customerPath(draft.customer)} className={buttonClass('outline', 'text-sm')}>
          {t('manager.approvals.customer')}
        </Link>
      </div>

      <section aria-labelledby="draft-terms" className="flex flex-col gap-2.5">
        <h3 id="draft-terms" className="m-0 text-sm font-semibold text-text-2">
          {t('manager.approvals.contract')}
        </h3>
        <dl className="m-0 flex flex-col gap-2">
          {draft.terms.map((term) => (
            <div key={term.key} className="flex items-baseline justify-between gap-3 text-sm">
              <dt className="text-text-2">{t(`manager.approvals.term.${term.key}`)}</dt>
              <dd className="m-0 text-end font-medium">{term.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="draft-checks" className="flex flex-col gap-2.5">
        <h3 id="draft-checks" className="m-0 text-sm font-semibold text-text-2">
          {t('manager.approvals.checks')}
        </h3>
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {draft.checks.map((check) => (
            <li
              key={check.text}
              className={`flex items-center gap-2.5 rounded-2xl px-3.5 py-2.5 text-sm ${check.ok ? 'bg-good-tint text-good' : 'bg-warn-tint text-warn'}`}
            >
              <Icon name={check.ok ? 'check' : 'alert'} size={18} />
              <span className="sr-only">
                {check.ok ? t('manager.approvals.ok') : t('manager.approvals.warn')}
              </span>
              {check.text}
            </li>
          ))}
        </ul>
      </section>

      {draft.note && (
        <section aria-labelledby="draft-note" className="flex flex-col gap-2">
          <h3 id="draft-note" className="m-0 text-sm font-semibold text-text-2">
            {t('manager.approvals.note')}
          </h3>
          <p className="m-0 rounded-2xl bg-canvas p-4 text-[15px] leading-8">{draft.note}</p>
        </section>
      )}

      <TextAreaField
        label={t('manager.approvals.comment')}
        placeholder={t('manager.approvals.commentPlaceholder')}
        rows={3}
        value={comment}
        onChange={(event) => setComment(event.target.value)}
        hint={tried && !comment.trim() ? t('manager.approvals.commentRequired') : undefined}
      />
      <div className="flex flex-wrap gap-2">
        <Button disabled={decide.isPending} onClick={() => act('approve')}>
          {t('manager.approvals.approve')}
        </Button>
        <Button variant="outline" disabled={decide.isPending} onClick={() => act('return')}>
          {t('manager.approvals.return')}
        </Button>
        <Button
          variant="danger"
          className="ms-auto"
          disabled={decide.isPending}
          onClick={() => act('reject')}
        >
          {t('manager.approvals.reject', { name: draft.name })}
        </Button>
      </div>
      {decide.isError && <Notice tone="error">{t('error')}</Notice>}
    </Card>
  );
}
