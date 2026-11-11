import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router';
import { Button } from '@/components/ui/Button';
import { buttonClass } from '@/components/ui/buttonStyles';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { TextAreaField } from '@/components/ui/Choices';
import { Dialog } from '@/components/ui/Dialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import { PageColumns } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import { QuerySection } from '@/components/ui/QuerySection';
import { StatGrid } from '@/components/ui/StatGrid';
import { ApiError } from '@/lib/api/client';
import { useFormat } from '@/lib/i18n/useFormat';
import {
  approvalDocumentQuery,
  approvalsQuery,
  useDecideDraft,
  type ApprovalAction,
  type ContractDraft,
} from '../api';
import { ContractSheet } from '../components/ContractSheet';
import { useSalesFormat } from '../format';
import { customerPath, salesPath } from '../paths';
import { ClauseChanges } from './ClauseChanges';
import { toast } from '@/lib/toast';

/**
 * The manager's agreement desk (S36, S62, S64): offers waiting for the sales manager, each with who
 * agreed, its numbers held to the contract builder's rules, the automatic checks and only the
 * clauses that differ from the standard contract; and the whole contract as it will print (S68),
 * to read before deciding. Canvas "صفحه‌ی مشتری", board "توافق · مدیر فروش".
 */
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
                        {draft.template.id !== null && (
                          <Chip tone="info" small>
                            {draft.template.name}
                          </Chip>
                        )}
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
  const [reading, setReading] = useState(false);

  const act = (action: ApprovalAction) => {
    setTried(true);
    // Returning or rejecting needs a word for the seller.
    if (action !== 'approve' && !comment.trim()) return;
    decide.mutate(
      { id: draft.id, action, comment: comment.trim() },
      {
        // 409: the customer has an open contract, or a country is no longer offered.
        onError: (error) =>
          toast.error(
            error instanceof ApiError && error.status === 409
              ? t('manager.approvals.conflict')
              : t('error'),
          ),
      },
    );
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
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setReading(true)}>{t('manager.approvals.read')}</Button>
          <Link to={customerPath(draft.customer)} className={buttonClass('outline', 'text-sm')}>
            {t('manager.approvals.customer')}
          </Link>
        </div>
      </div>

      <ul
        aria-label={t('manager.approvals.parties')}
        className="m-0 flex list-none flex-wrap gap-2 p-0"
      >
        {draft.parties.map((party) => (
          <li key={party.party}>
            <Chip tone={party.agreed_at ? 'good' : 'warn'}>
              {t(party.agreed_at ? 'manager.approvals.agreed' : 'manager.approvals.waiting', {
                role: t(`manager.approvals.party.${party.party}`),
              })}
            </Chip>
          </li>
        ))}
      </ul>

      <Figures draft={draft} />

      <section aria-labelledby="draft-terms" className="flex flex-col gap-2.5">
        <h3 id="draft-terms" className="m-0 text-sm font-semibold text-text-2">
          {t('manager.approvals.contract')}
        </h3>
        {draft.resubmitted && (
          <p className="m-0 text-sm text-text-2">{t('manager.approvals.resubmitted')}</p>
        )}
        <dl className="m-0 flex flex-col gap-2">
          {draft.terms.map((term) => (
            <div
              key={term.key}
              className={`flex items-baseline justify-between gap-3 text-sm ${term.previous === null ? '' : '-mx-3 rounded-xl bg-warn-tint px-3 py-2'}`}
            >
              <dt className="text-text-2">
                {t(`manager.approvals.term.${term.key}`)}
                {term.previous !== null && (
                  <span className="sr-only"> {t('manager.approvals.changed')}</span>
                )}
              </dt>
              <dd className="m-0 flex flex-col items-end gap-0.5 text-end font-medium">
                <span>{term.value}</span>
                {term.previous !== null && (
                  <span className="text-xs font-normal text-text-2 line-through">
                    {t('manager.approvals.previous', { value: term.previous })}
                  </span>
                )}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <ClauseChanges changes={draft.clauses} standard={draft.standard_clauses} />
      <button
        type="button"
        onClick={() => setReading(true)}
        className="-mt-3 flex min-h-11 items-center gap-2 self-start text-sm font-semibold text-primary-text hover:underline"
      >
        <Icon name="document" size={18} />
        {t('manager.approvals.readAll')}
      </button>

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
      <Dialog
        open={reading}
        onClose={() => setReading(false)}
        size="wide"
        title={t('manager.approvals.preview.title', { name: draft.name })}
        subtitle={t('manager.approvals.preview.subtitle')}
        closeLabel={t('close')}
        footer={
          <div className="flex flex-wrap gap-2">
            <Link
              to={salesPath(`manager/approvals/${String(draft.id)}/contract`)}
              className={buttonClass('outline', 'text-sm')}
            >
              {t('manager.approvals.preview.print')}
            </Link>
            <Button variant="outline" onClick={() => setReading(false)}>
              {t('close')}
            </Button>
          </div>
        }
      >
        <DraftContract id={draft.id} />
      </Dialog>
    </Card>
  );
}

/** The offer's whole contract as it will print (S68), read before deciding. */
function DraftContract({ id }: { id: number }) {
  const query = useQuery(approvalDocumentQuery(id));
  return (
    <QuerySection pending={query.isPending} error={query.error} retry={() => void query.refetch()}>
      {query.data && <ContractSheet doc={query.data} framed={false} />}
    </QuerySection>
  );
}

/** The offer's numbers, each against the rule the manager set; a number past it shows in red. */
function Figures({ draft }: { draft: ContractDraft }) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const s = useSalesFormat();
  const n = draft.figures;
  const percent = (value: number) => s.percent(value / 100);
  return (
    <StatGrid
      compact
      label={t('manager.approvals.figures')}
      stats={[
        {
          label: t('manager.approvals.figure.amount'),
          value: s.inCurrency(n.amount, n.currency ?? 'IRT'),
          ...(n.list_price !== n.amount && {
            note: t('manager.approvals.figure.list', {
              amount: s.inCurrency(n.list_price, n.currency ?? 'IRT'),
            }),
          }),
        },
        {
          label: t('manager.approvals.figure.discount'),
          value: percent(n.discount),
          tone: n.discount > n.approval_above ? 'urgent' : 'default',
          note: t('manager.approvals.figure.discountRule', { n: percent(n.approval_above) }),
        },
        {
          label: t('manager.approvals.figure.prepayment'),
          value: percent(n.prepayment_percent),
          tone: n.prepayment_percent < n.min_prepayment ? 'urgent' : 'default',
          note: n.min_prepayment
            ? t('manager.approvals.figure.prepaymentRule', { n: percent(n.min_prepayment) })
            : s.inCurrency(n.prepayment, n.currency ?? 'IRT'),
        },
        {
          label: t('manager.approvals.figure.instalments'),
          value: f.number(n.instalments),
          tone: n.instalments > n.max_instalments ? 'urgent' : 'default',
          note: t('manager.approvals.figure.instalmentsRule', { n: f.number(n.max_instalments) }),
        },
      ]}
    />
  );
}
