import { useSuspenseQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { PageColumns } from '@/components/ui/PageColumns';
import { customerQuery } from './api';
import { CustomerAside } from './components/CustomerAside';
import { CustomerTasks } from './components/CustomerTasks';
import { HistoryCard } from './components/HistoryCard';
import { useCustomerId } from './useCustomerId';

/** The customer's summary tab: open tasks, history, score and profile. */
export default function CustomerSummaryPage() {
  const { t } = useTranslation('sales');
  const { data } = useSuspenseQuery(customerQuery(useCustomerId()));
  return (
    <>
      <CustomerTasks customer={data} />
      <PageColumns
        asideLabel={t('customer.summary')}
        main={<HistoryCard customer={data.id} />}
        aside={<CustomerAside customer={data} />}
      />
    </>
  );
}
