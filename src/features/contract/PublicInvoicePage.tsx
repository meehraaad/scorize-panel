import { useSuspenseQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useParams } from 'react-router';
import { buttonClass } from '@/components/ui/buttonStyles';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Icon } from '@/components/ui/Icon';
import { Notice } from '@/components/ui/Notice';
import { loginHref } from '@/lib/auth/session';
import { useFormat } from '@/lib/i18n/useFormat';
import { publicInvoiceQuery, type PublicInvoice } from './api';
import { useMoney } from './payment/money';

/**
 * An invoice by its public link (`/pay/<token>`: the seller's SMS, the bank's return), signed out
 * or as another account (canvas D1–D3). It shows the invoice or its result; paying, receipts and
 * next steps need the login, which comes back here and on to the payment page. Its owner, signed
 * in, never sees this: the route sends them to the payment page.
 */
export default function PublicInvoicePage() {
  const token = useParams().token ?? '';
  const { t } = useTranslation('contract');
  const { data } = useSuspenseQuery(publicInvoiceQuery(token));
  const { pathname, search } = useLocation();
  const login = loginHref(pathname + search);

  if (!data || data.other_account) return <NotFound otherAccount={data?.other_account ?? false} />;

  return (
    <div className="flex flex-col gap-4">
      {data.status === 'paid' ? (
        <Paid invoice={data} login={login} />
      ) : data.status === 'failed' ? (
        <Card className="flex flex-col items-center gap-3 p-5 text-center">
          <span
            aria-hidden="true"
            className="flex size-14 items-center justify-center rounded-full bg-danger-tint text-danger"
          >
            <Icon name="alert" size={26} />
          </span>
          <h1 className="m-0 text-xl font-bold">{t('payment.failed.title')}</h1>
          <p className="m-0 text-sm leading-7 text-text-2">{t('payment.failed.refund')}</p>
        </Card>
      ) : (
        <Header invoice={data} />
      )}
      <Items invoice={data} />
      {data.status !== 'paid' && (
        <div className="flex flex-col gap-2">
          <a href={login} className={buttonClass('primary', '', 'lg', 'rounded')}>
            {data.status === 'failed'
              ? t('payment.public.loginRetry')
              : t('payment.public.loginPay')}
          </a>
          <a href={login} className={buttonClass('outline')}>
            {t('payment.public.loginReceipt')}
          </a>
          {data.phone && (
            <p className="m-0 text-center text-[13px] leading-6 text-text-2">
              {t('payment.public.withPhone')}{' '}
              <span dir="ltr" className="font-semibold text-text">
                {data.phone}
              </span>{' '}
              {t('payment.public.loginNote')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Header({ invoice }: { invoice: PublicInvoice }) {
  const { t } = useTranslation('contract');
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h1 className="m-0 text-xl font-bold">{t('payment.public.title')}</h1>
        <Chip tone={invoice.status === 'expired' ? 'neutral' : 'warn'} dot>
          {t(`payment.public.status.${invoice.status}`)}
        </Chip>
      </div>
      {invoice.seller && invoice.customer && (
        <p className="m-0 text-sm leading-7 text-text-2">
          {t('payment.public.madeBy', { seller: invoice.seller, customer: invoice.customer })}
        </p>
      )}
    </div>
  );
}

function Paid({ invoice, login }: { invoice: PublicInvoice; login: string }) {
  const { t } = useTranslation('contract');
  const f = useFormat();
  const money = useMoney(invoice.currency);
  return (
    <>
      <Card className="flex flex-col items-center gap-2 p-5 text-center">
        <span
          aria-hidden="true"
          className="flex size-14 items-center justify-center rounded-full bg-good-tint text-good"
        >
          <Icon name="check" size={26} />
        </span>
        <h1 className="m-0 text-xl font-bold">{t('payment.result.paid')}</h1>
        <b className="text-lg tabular-nums">{money(invoice.amount)}</b>
        {invoice.paid_at && (
          <span className="text-[13px] text-text-2">{f.dateTime(invoice.paid_at)}</span>
        )}
        {invoice.ref_id && (
          <span className="text-[13px] text-text-2">
            {t('payment.result.ref')}{' '}
            <span dir="ltr" className="font-semibold text-text">
              {f.digits(invoice.ref_id)}
            </span>
          </span>
        )}
      </Card>
      <Notice tone="info">{t('payment.public.paidLogin')}</Notice>
      <a href={login} className={buttonClass('primary', '', 'lg', 'rounded')}>
        {t('payment.public.loginContinue')}
      </a>
    </>
  );
}

function Items({ invoice }: { invoice: PublicInvoice }) {
  const { t } = useTranslation('contract');
  const f = useFormat();
  const money = useMoney(invoice.currency);
  const rows: [string, string][] = [];
  if (invoice.credit_used > 0) {
    rows.push([t('payment.public.sum'), money(invoice.total + invoice.credit_used)]);
    rows.push([t('payment.credit'), `−${money(invoice.credit_used)}`]);
  }
  rows.push([t('payment.created'), f.dateTime(invoice.created_at)]);

  return (
    <Card className="overflow-hidden">
      <ol className="m-0 list-none p-0">
        {invoice.items.map((item, index) => (
          <li
            key={`${String(index)}-${item.label}`}
            className="flex justify-between gap-3 px-5 py-3 text-[15px] shadow-[inset_0_1px_0_var(--hair)] first:shadow-none"
          >
            <span>
              {f.number(index + 1)}. {item.label}
            </span>
            <b className="whitespace-nowrap tabular-nums">{money(item.amount)}</b>
          </li>
        ))}
      </ol>
      <dl className="m-0">
        {rows.map(([label, value]) => (
          <div
            key={label}
            className="flex justify-between gap-3 px-5 py-3 text-sm shadow-[inset_0_1px_0_var(--hair)]"
          >
            <dt className="text-text-2">{label}</dt>
            <dd className="m-0">{value}</dd>
          </div>
        ))}
        <div className="flex items-baseline justify-between gap-3 px-5 py-3.5 shadow-[inset_0_1px_0_var(--hair)]">
          <dt className="text-sm text-text-2">{t('payment.amount')}</dt>
          <dd className="m-0 text-lg font-bold tabular-nums">{money(invoice.amount)}</dd>
        </div>
      </dl>
    </Card>
  );
}

/** Unknown link, or an invoice of another account (D3). */
function NotFound({ otherAccount }: { otherAccount: boolean }) {
  const { t } = useTranslation('contract');
  return (
    <Card className="flex flex-col items-center gap-3 p-6 text-center">
      <span
        aria-hidden="true"
        className="flex size-14 items-center justify-center rounded-full bg-neutral-tint text-text-2"
      >
        <Icon name="search" size={26} />
      </span>
      <h1 className="m-0 text-xl font-bold">{t('payment.missing.title')}</h1>
      <p className="m-0 text-sm leading-7 text-text-2">{t('payment.missing.text')}</p>
      <Link to="/payments" className={buttonClass('primary')}>
        {t('payment.missing.open')}
      </Link>
      {otherAccount && (
        <Link to="/account" className={buttonClass('outline')}>
          {t('payment.missing.otherAccount')}
        </Link>
      )}
    </Card>
  );
}
