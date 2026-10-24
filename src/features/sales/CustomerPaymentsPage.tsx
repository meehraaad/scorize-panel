import { useSuspenseQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { Button } from '@/components/ui/Button';
import { buttonClass } from '@/components/ui/buttonStyles';
import { Card } from '@/components/ui/Card';
import { Chip, type ChipTone } from '@/components/ui/Chip';
import { SelectField } from '@/components/ui/Choices';
import { EmptyState } from '@/components/ui/EmptyState';
import { InlineConfirm } from '@/components/ui/InlineConfirm';
import { Notice } from '@/components/ui/Notice';
import { PageColumns } from '@/components/ui/PageColumns';
import { useFormat } from '@/lib/i18n/useFormat';
import { useConfirmReceipt } from '@/lib/sales/api';
import { safeHref } from '@/lib/url';
import {
  paymentsQuery,
  usePaymentAction,
  type PaymentMethod,
  type PaymentRow,
  type PaymentStatus,
  type PaymentsData,
} from './api';
import { useCustomerId } from './useCustomerId';
import { useSalesFormat } from './format';

const TONE: Record<PaymentStatus, ChipTone> = {
  pending: 'neutral',
  paid: 'good',
  paid_by_receipt: 'good',
  expired: 'neutral',
  failed: 'danger',
  pending_receipt: 'warn',
  receipt_declined: 'danger',
};

const COLUMNS = ['number', 'what', 'amount', 'method', 'status', 'date'] as const;

/**
 * The customer's invoices, and what a seller can do with one: confirm or decline a receipt, change
 * the method or destination account, text the invoice. Same actions as the old crm payments page.
 */
export default function CustomerPaymentsPage() {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const s = useSalesFormat();
  const { data } = useSuspenseQuery(paymentsQuery(useCustomerId()));
  const [params, setParams] = useSearchParams();
  const selected =
    data.results.find((row) => String(row.id) === params.get('payment')) ?? data.results[0];

  if (!selected) return <EmptyState variant="card">{t('payments.empty')}</EmptyState>;

  const pick = (row: PaymentRow) =>
    setParams(
      (current) => {
        current.set('payment', String(row.id));
        return current;
      },
      { replace: true },
    );

  return (
    <PageColumns
      asideLabel={t('payments.detail')}
      main={
        <Card aria-labelledby="payments-title">
          <h2
            id="payments-title"
            className="m-0 px-5 pt-5 pb-3 font-display text-xl font-bold lg:px-8 lg:pt-7"
          >
            {t('payments.title')}
          </h2>
          <div className="overflow-x-auto pb-2">
            <table className="w-full min-w-[640px] border-collapse">
              <thead>
                <tr className="text-[13px] text-text-2">
                  {COLUMNS.map((column) => (
                    <th
                      key={column}
                      scope="col"
                      className="px-3 py-2 text-start font-medium first:ps-5 last:pe-5 lg:first:ps-8 lg:last:pe-8"
                    >
                      {t(`payments.column.${column}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.results.map((row) => {
                  const current = row.id === selected.id;
                  return (
                    <tr
                      key={row.id}
                      className={`shadow-[inset_0_1px_0_var(--hair)] ${current ? 'bg-row-highlight' : 'hover:bg-canvas'}`}
                    >
                      <td className="px-3 py-3 ps-5 lg:ps-8">
                        <button
                          type="button"
                          aria-pressed={current}
                          aria-label={t('payments.open', {
                            id: f.digits(String(row.id)),
                            what: row.what,
                          })}
                          onClick={() => pick(row)}
                          className="inline-flex min-h-11 items-center font-semibold text-primary-text tabular-nums hover:underline"
                        >
                          <span dir="ltr">#{f.digits(String(row.id))}</span>
                        </button>
                      </td>
                      <td className="px-3 py-3 text-sm">{row.what}</td>
                      <td className="px-3 py-3 text-sm font-semibold tabular-nums">
                        {s.toman(row.amount)}
                      </td>
                      <td className="px-3 py-3 text-sm text-text-2">
                        {t(`payments.method.${row.method}`)}
                      </td>
                      <td className="px-3 py-3">
                        <Chip tone={TONE[row.status]} small>
                          {t(`payments.status.${row.status}`)}
                        </Chip>
                      </td>
                      <td className="px-3 py-3 pe-5 text-sm text-text-2 lg:pe-8">
                        {f.dateShort(row.created_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      }
      aside={<PaymentDetail key={selected.id} payment={selected} wallets={data.wallets} />}
    />
  );
}

function PaymentDetail({
  payment,
  wallets,
}: {
  payment: PaymentRow;
  wallets: PaymentsData['wallets'];
}) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const s = useSalesFormat();
  const customer = useCustomerId();
  const confirm = useConfirmReceipt();
  const action = usePaymentAction(customer);
  const [declining, setDeclining] = useState(false);
  const [copied, setCopied] = useState(false);
  const wallet = wallets.find((item) => item.id === payment.wallet)?.name ?? '';
  const paid = payment.status === 'paid' || payment.status === 'paid_by_receipt';
  const failed = confirm.isError || action.isError;

  return (
    <Card aria-labelledby="payment-detail" className="flex flex-col gap-5 p-5 lg:p-7">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span dir="ltr" className="text-start text-xs text-text-2">
            #{f.digits(String(payment.id))}
          </span>
          <h2 id="payment-detail" className="m-0 font-display text-lg font-bold">
            {payment.what}
          </h2>
        </div>
        <Chip tone={TONE[payment.status]} small>
          {t(`payments.status.${payment.status}`)}
        </Chip>
      </div>

      <dl className="m-0 flex flex-col gap-2.5">
        {payment.lines.map((line) => (
          <div key={line.label} className="flex items-baseline justify-between gap-3 text-sm">
            <dt className="text-neutral">{line.label}</dt>
            <dd className="m-0 tabular-nums">{s.toman(line.amount)}</dd>
          </div>
        ))}
        <div className="flex items-baseline justify-between gap-3 pt-2.5 text-[15px] font-bold shadow-[inset_0_1px_0_var(--hair)]">
          <dt>{t('payments.payable')}</dt>
          <dd className="m-0 tabular-nums">{s.toman(payment.amount)}</dd>
        </div>
      </dl>

      {payment.status === 'pending_receipt' && payment.receipt && (
        <div className="flex flex-col gap-3 rounded-2xl bg-warn-tint p-4">
          <span className="text-sm font-semibold text-warn">{t('payments.receipt.waiting')}</span>
          <a
            href={safeHref(payment.receipt.url)}
            target="_blank"
            rel="noreferrer"
            className={buttonClass('outline', 'self-start text-sm')}
          >
            {t('payments.receipt.view')}
          </a>
          <span className="text-xs leading-6 text-neutral">
            {t('payments.receipt.meta', { wallet, when: f.timeAgo(payment.receipt.uploaded_at) })}
          </span>
          {declining ? (
            <InlineConfirm
              message={t('payments.receipt.declineConfirm')}
              confirmLabel={t('payments.receipt.decline')}
              cancelLabel={t('cancel')}
              pending={action.isPending}
              onCancel={() => setDeclining(false)}
              onConfirm={() => action.mutate({ payment: payment.id, action: { kind: 'decline' } })}
            />
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={confirm.isPending}
                onClick={() => confirm.mutate({ customer, payment: payment.id })}
              >
                {t('payments.receipt.confirm')}
              </Button>
              <Button variant="danger" onClick={() => setDeclining(true)}>
                {t('payments.receipt.decline')}
              </Button>
            </div>
          )}
          <span className="text-xs text-neutral">{t('payments.receipt.declineNote')}</span>
        </div>
      )}

      {payment.status === 'pending' && (
        <div className="flex flex-col gap-4">
          <SelectField
            label={t('payments.methodLabel')}
            value={payment.method}
            onChange={(method: PaymentMethod) =>
              action.mutate({ payment: payment.id, action: { kind: 'method', method } })
            }
            options={(['online', 'receipt'] as const).map((value) => ({
              value,
              label: t(`payments.methodOption.${value}`),
            }))}
          />
          {payment.method === 'receipt' && (
            <SelectField
              label={t('payments.wallet')}
              value={String(payment.wallet)}
              onChange={(value) =>
                action.mutate({
                  payment: payment.id,
                  action: { kind: 'wallet', wallet: Number(value) },
                })
              }
              options={wallets.map((item) => ({ value: String(item.id), label: item.name }))}
            />
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={action.isPending}
              onClick={() => action.mutate({ payment: payment.id, action: { kind: 'factor' } })}
            >
              {t('payments.sendFactor')}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                void navigator.clipboard.writeText(payment.pay_url).then(() => setCopied(true));
              }}
            >
              {copied ? t('payments.copied') : t('payments.copyLink')}
            </Button>
          </div>
          {payment.factor && (
            <span className="text-xs leading-6 text-text-2">
              {t(payment.factor.opened ? 'payments.factorOpened' : 'payments.factorNotOpened', {
                when: f.timeAgo(payment.factor.sent_at),
              })}
            </span>
          )}
        </div>
      )}

      {paid && (
        <Notice tone="success">
          {payment.reference
            ? t('payments.paidRef', { reference: payment.reference })
            : t('payments.paid')}
        </Notice>
      )}
      {payment.status === 'receipt_declined' && (
        <Notice tone="info">{t('payments.declinedNote')}</Notice>
      )}
      {failed && <Notice tone="error">{t('error')}</Notice>}
    </Card>
  );
}
