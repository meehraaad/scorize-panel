import { useSuspenseQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, useParams, useSearchParams } from 'react-router';
import { BackLink } from '@/components/ui/BackLink';
import { buttonClass } from '@/components/ui/buttonStyles';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageStack } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import { TOMAN } from '@/lib/i18n/useFormat';
import { paymentQuery, type PaymentData } from './api';
import { Purchase } from './payment/Purchase';
import { Checking, Declined, Expired, Failed, InReview, Result } from './payment/Outcomes';

/**
 * One invoice, from buying to what comes next (canvas "Scorize Payment States"): an instalment, a
 * services purchase, a booked session, a campaign or a seller's invoice. Unpaid: the purchase
 * screen (A1). Then the result with what is left to do (B1), or why it didn't go through (B4, B5),
 * and card transfer's review (C1–C3). `?method=receipt` opens card transfer directly.
 */
export default function PaymentPage() {
  const id = Number(useParams().id);

  if (!Number.isInteger(id) || id <= 0) return <Missing />;
  return <Payment id={id} key={id} />;
}

function Payment({ id }: { id: number }) {
  const { t } = useTranslation('contract');
  const { data } = useSuspenseQuery(paymentQuery(id));

  if (!data) return <Missing />;
  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col gap-4 lg:gap-[18px]">
      <BackLink to={backOf(data)}>{t('payment.back')}</BackLink>
      <State payment={data} />
    </div>
  );
}

function State({ payment }: { payment: PaymentData }) {
  const [params] = useSearchParams();
  // The bank takes only toman (H25); other currencies are paid by card transfer (A4).
  const toman = !payment.currency || payment.currency === TOMAN;
  switch (payment.status) {
    case 'unpaid':
      return (
        <Purchase
          payment={payment}
          toman={toman}
          receipt={!toman || params.get('method') === 'receipt'}
        />
      );
    case 'declined':
      return <Declined payment={payment} toman={toman} />;
    case 'review':
      return <InReview payment={payment} />;
    case 'paid':
      return <Result payment={payment} />;
    case 'failed':
      return <Failed payment={payment} />;
    case 'expired':
      return <Expired payment={payment} />;
    case 'checking':
      return <Checking payment={payment} />;
  }
}

/** An instalment goes back to the contract; anything else to the open payments. */
const backOf = (payment: PaymentData) => (payment.installment === null ? '/payments' : '/contract');

function Missing() {
  const { t } = useTranslation('contract');
  return (
    <PageStack>
      <PageHeader title={t('payment.title')} />
      <EmptyState
        variant="card"
        title={t('payment.missing.title')}
        action={
          <Link to="/payments" className={buttonClass('primary')}>
            {t('payment.missing.open')}
          </Link>
        }
      >
        {t('payment.missing.text')}
      </EmptyState>
    </PageStack>
  );
}
