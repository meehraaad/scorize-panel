import { useSuspenseQuery } from '@tanstack/react-query';
import { customerQuery } from './api';
import { CustomerInsights } from './components/CustomerInsights';
import { CustomerTasks } from './components/CustomerTasks';
import { HistoryCard } from './components/HistoryCard';
import { useCustomerId } from './useCustomerId';

/**
 * The customer's summary tab: open tasks, what helps convince them (or what to ask first), and
 * the history of calls, messages, sessions and payments. Canvas boards Main and EmptyMain.
 */
export default function CustomerSummaryPage() {
  const { data } = useSuspenseQuery(customerQuery(useCustomerId()));
  return (
    <>
      <CustomerTasks customer={data} />
      <div className="grid gap-4 empty:hidden lg:grid-cols-2 lg:gap-6 [&>*:only-child]:lg:col-span-2">
        <CustomerInsights customer={data} />
      </div>
      <HistoryCard customer={data.id} />
    </>
  );
}
