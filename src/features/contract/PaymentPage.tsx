import { useSuspenseQuery } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams, useSearchParams } from 'react-router';
import { BackLink } from '@/components/ui/BackLink';
import { Button } from '@/components/ui/Button';
import { buttonClass } from '@/components/ui/buttonStyles';
import { Card } from '@/components/ui/Card';
import { Chip, type ChipTone } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Notice } from '@/components/ui/Notice';
import { PageStack } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { TOMAN, useFormat } from '@/lib/i18n/useFormat';
import { safeHref } from '@/lib/url';
import { paymentQuery, useStartOnlinePayment, type PaymentData, type PaymentStatus } from './api';
import { ReceiptForm } from './components/ReceiptForm';
import { toast } from '@/lib/toast';

const TONE: Record<PaymentStatus, ChipTone> = {
  unpaid: 'warn',
  review: 'info',
  declined: 'danger',
  paid: 'good',
};

/**
 * One invoice: an instalment of the contract or a services purchase. Pay online (bank gateway) or
 * by card transfer with a receipt the sales team checks. Design: canvas V6 section 11 (AppPayment,
 * four states). `?method=receipt` opens the receipt form directly (the instalment's button).
 */
export default function PaymentPage() {
  const id = Number(useParams().id);

  if (!Number.isInteger(id) || id <= 0) return <Missing />;
  return <Payment id={id} key={id} />;
}

function Payment({ id }: { id: number }) {
  const { t } = useTranslation('contract');
  const f = useFormat();
  const { data } = useSuspenseQuery(paymentQuery(id));
  const [params] = useSearchParams();
  // The bank gateway takes only toman (H25); other currencies are paid by card transfer.
  const online = !data?.currency || data.currency === TOMAN;
  const [method, setMethod] = useState<'online' | 'receipt'>(() =>
    !online || params.get('method') === 'receipt' || data?.status === 'declined'
      ? 'receipt'
      : 'online',
  );

  if (!data) return <Missing />;
  const payable = data.status === 'unpaid' || data.status === 'declined';

  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col gap-4 lg:gap-[18px]">
      <BackLink to={data.installment === null ? '/services' : '/contract'}>
        {t('payment.back')}
      </BackLink>
      <PageHeader
        title={t('payment.title')}
        actions={
          <Chip tone={TONE[data.status]} dot>
            {t(`payment.status.${data.status}`)}
          </Chip>
        }
      />

      {data.status === 'declined' && (
        <Notice tone="error">
          <span className="flex flex-col gap-1">
            <span className="font-bold">{t('payment.declined.title')}</span>
            <span className="text-text">
              {[data.decline_reason, t('payment.declined.text')].filter(Boolean).join(' ')}
            </span>
          </span>
        </Notice>
      )}

      <Summary payment={data} method={payable ? method : data.method} />

      {payable && method === 'online' && (
        <OnlineCard payment={data} onReceipt={() => setMethod('receipt')} />
      )}
      {payable && method === 'receipt' && (
        <ReceiptForm payment={data} onOnline={online ? () => setMethod('online') : undefined} />
      )}
      {data.status === 'review' && (
        <Outcome icon="clock" tone="bg-info-tint text-info" title={t('payment.review.title')}>
          <p className="m-0 text-sm leading-7 text-text-2">{t('payment.review.text')}</p>
          {data.receipt && (
            <a
              href={safeHref(data.receipt.url)}
              target="_blank"
              rel="noopener"
              className={buttonClass('outline')}
            >
              {t('payment.review.view')}
            </a>
          )}
        </Outcome>
      )}
      {data.status === 'paid' && (
        <Outcome icon="check" tone="bg-good-tint text-good" title={t('payment.paid.title')}>
          {data.paid_at && (
            <p className="m-0 text-sm leading-7 text-text-2">
              {t('payment.paid.text', { date: f.dateTime(data.paid_at) })}
            </p>
          )}
        </Outcome>
      )}
    </div>
  );
}

/** Items, credit and the amount to pay, with when and by whom the invoice was made. */
function Summary({ payment, method }: { payment: PaymentData; method: PaymentData['method'] }) {
  const { t } = useTranslation('contract');
  const f = useFormat();
  const money = (amount: number) =>
    f.price(amount, payment.currency, (value) => t('amount', { amount: value }));
  const facts = [
    [t('payment.total'), money(payment.total)],
    payment.credit_used > 0 && [t('payment.credit'), money(payment.credit_used)],
    method && [t('payment.method'), t(`payment.methodName.${method}`)],
    [t('payment.created'), f.dateTime(payment.created_at)],
    payment.seller && [t('payment.seller'), payment.seller],
    payment.paid_at && [t('payment.paidAt'), f.dateTime(payment.paid_at)],
  ].filter((fact): fact is [string, string] => Array.isArray(fact));

  return (
    <SectionCard id="payment-items" title={t('payment.items')} size="md">
      <ol className="m-0 list-none px-5 pb-2 lg:px-[26px]">
        {payment.items.map((item, index) => (
          <li
            key={`${String(index)}-${item.label}`}
            className={`flex justify-between gap-3 py-3 text-[15px] ${
              index > 0 ? 'shadow-[inset_0_1px_0_var(--hair)]' : ''
            }`}
          >
            <span>
              {f.number(index + 1)}. {item.label}
            </span>
            <span className="font-semibold whitespace-nowrap tabular-nums">
              {money(item.amount)}
            </span>
          </li>
        ))}
      </ol>
      <dl className="m-0 flex flex-col gap-2.5 px-5 pt-1 pb-5 shadow-[inset_0_1px_0_var(--hair)] lg:px-[26px] lg:pb-[26px]">
        {facts.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-3 pt-2.5 text-sm">
            <dt className="text-text-2">{label}</dt>
            <dd className="m-0 text-end font-medium">{value}</dd>
          </div>
        ))}
        <div className="flex items-baseline justify-between gap-3 pt-2.5 text-sm">
          <dt className="text-text-2">{t('payment.amount')}</dt>
          <dd className="m-0 text-lg font-bold tabular-nums">{money(payment.amount)}</dd>
        </div>
      </dl>
    </SectionCard>
  );
}

function OnlineCard({ payment, onReceipt }: { payment: PaymentData; onReceipt: () => void }) {
  const { t } = useTranslation('contract');
  const f = useFormat();
  const start = useStartOnlinePayment();
  // Stays "redirecting" after success: the browser is leaving for the gateway.
  const busy = start.isPending || start.isSuccess;

  return (
    <Card className="flex flex-col gap-3 p-5 lg:p-[26px]">
      <Button
        size="lg"
        disabled={busy}
        onClick={() =>
          start.mutate(payment.id, {
            onError: () => toast.error(t('payment.onlineError')),
            onSuccess: ({ redirect_url }) => window.location.assign(redirect_url),
          })
        }
      >
        {busy
          ? t('payment.redirecting')
          : t('payment.payOnline', { amount: f.number(payment.amount) })}
      </Button>
      <Button variant="outline" disabled={busy} onClick={onReceipt}>
        {t('payment.toReceipt')}
      </Button>
      <span className="flex items-center justify-center gap-1.5 text-[13px] text-text-2">
        <Icon name="shield" size={16} />
        {t('payment.gateway')}
      </span>
    </Card>
  );
}

/** Where the invoice stands once nothing is left to do: receipt in review, or paid. */
function Outcome({
  icon,
  tone,
  title,
  children,
}: {
  icon: IconName;
  tone: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <Card className="flex flex-col items-center gap-3.5 p-5 text-center lg:p-[26px]">
      <span
        aria-hidden="true"
        className={`flex size-14 items-center justify-center rounded-full ${tone}`}
      >
        <Icon name={icon} size={26} />
      </span>
      <h2 className="m-0 text-[17px] font-bold">{title}</h2>
      {children}
    </Card>
  );
}

function Missing() {
  const { t } = useTranslation('contract');
  return (
    <PageStack>
      <PageHeader title={t('payment.title')} />
      <EmptyState
        variant="card"
        action={
          <Link to="/contract" className={buttonClass('primary')}>
            {t('payment.toContract')}
          </Link>
        }
      >
        {t('payment.invalid')}
      </EmptyState>
    </PageStack>
  );
}
