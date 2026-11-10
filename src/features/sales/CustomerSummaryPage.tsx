import { useSuspenseQuery } from '@tanstack/react-query';
import { customerQuery } from './api';
import { ContractCard } from './components/ContractCard';
import { CustomerInsights } from './components/CustomerInsights';
import { CustomerTasks } from './components/CustomerTasks';
import { HistoryCard } from './components/HistoryCard';
import { useCustomerId } from './useCustomerId';

/**
 * The customer's summary tab: their contract while it is on its way (S71), open tasks, the history of calls, messages, sessions and payments,
 * and what helps convince them (or what to ask first). Canvas boards Main and EmptyMain.
 */
export default function CustomerSummaryPage() {
  const { data } = useSuspenseQuery(customerQuery(useCustomerId()));
  return (
    <>
      <ContractCard customer={data.id} />
      <CustomerTasks customer={data} />
      <HistoryCard customer={data.id} />
      <div className="grid gap-4 empty:hidden lg:grid-cols-2 lg:gap-6 [&>*:only-child]:lg:col-span-2">
        <CustomerInsights customer={data} />
      </div>
    </>
  );
}
