import { useSuspenseQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { agreementQuery, paymentsQuery, purchasesQuery } from './api';
import { AgreementDesk } from './components/AgreementDesk';
import CustomerPaymentsPage from './CustomerPaymentsPage';
import CustomerPurchasesPage from './CustomerPurchasesPage';
import { useCustomerId } from './useCustomerId';

/**
 * The "contract and money" tab: what the customer bought (consultations, writing, packages), then
 * their invoices and receipts, under the contract agreement desk while an offer is being agreed.
 * One tab instead of two (canvas boards Money, EmptyMoney and AgreeSales).
 */
export default function CustomerMoneyPage() {
  const { t } = useTranslation('sales');
  const id = useCustomerId();
  const { data: purchases } = useSuspenseQuery(purchasesQuery(id));
  const { data: payments } = useSuspenseQuery(paymentsQuery(id));
  const { data: agreement } = useSuspenseQuery(agreementQuery(id));
  const [, setParams] = useSearchParams();

  if (purchases.items.length === 0 && payments.results.length === 0 && !agreement)
    return (
      <EmptyState
        variant="card"
        icon="card"
        title={t('money.emptyTitle')}
        action={
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() =>
                setParams(
                  (current) => {
                    current.set('sell', 'consultation');
                    return current;
                  },
                  { replace: true },
                )
              }
            >
              {t('customer.newSale.product')}
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                setParams(
                  (current) => {
                    current.set('contract', 'new');
                    return current;
                  },
                  { replace: true },
                )
              }
            >
              {t('customer.newSale.offer')}
            </Button>
          </div>
        }
      >
        {t('money.empty')}
      </EmptyState>
    );

  return (
    <>
      <AgreementDesk customer={id} />
      <CustomerPurchasesPage />
      <CustomerPaymentsPage />
    </>
  );
}
