import { useSuspenseQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router';
import { Button } from '@/components/ui/Button';
import { buttonClass } from '@/components/ui/buttonStyles';
import { EmptyState } from '@/components/ui/EmptyState';
import { paymentsQuery, purchasesQuery } from './api';
import CustomerPaymentsPage from './CustomerPaymentsPage';
import CustomerPurchasesPage from './CustomerPurchasesPage';
import { customerPath } from './paths';
import { useCustomerId } from './useCustomerId';

/**
 * The "contract and money" tab: what the customer bought (consultations, writing, packages), then
 * their invoices and receipts. One tab instead of two (canvas boards Money and EmptyMoney).
 */
export default function CustomerMoneyPage() {
  const { t } = useTranslation('sales');
  const id = useCustomerId();
  const { data: purchases } = useSuspenseQuery(purchasesQuery(id));
  const { data: payments } = useSuspenseQuery(paymentsQuery(id));
  const [, setParams] = useSearchParams();

  if (purchases.items.length === 0 && payments.results.length === 0)
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
            <Link to={`${customerPath(id)}/offer`} className={buttonClass('outline')}>
              {t('customer.newSale.offer')}
            </Link>
          </div>
        }
      >
        {t('money.empty')}
      </EmptyState>
    );

  return (
    <>
      <CustomerPurchasesPage />
      <CustomerPaymentsPage />
    </>
  );
}
