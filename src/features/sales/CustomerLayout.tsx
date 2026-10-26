import { useSuspenseQuery } from '@tanstack/react-query';
import { Suspense, lazy, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet, useSearchParams } from 'react-router';
import { BackLink } from '@/components/ui/BackLink';
import { PageStack } from '@/components/ui/PageColumns';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { useDocumentTitle } from '@/lib/useDocumentTitle';
import { whenIdle } from '@/lib/whenIdle';
import type { MessageChannel } from '@/lib/sales/api';
import { customerQuery, type ProductCategory } from './api';
import { CustomerHero } from './components/CustomerHero';
import { CustomerTabs } from './components/CustomerTabs';
import type { LogStart } from './components/LogDialog';
import { salesPath, type LogIntent } from './paths';
import { useCustomerId } from './useCustomerId';

const INTENTS: readonly LogIntent[] = ['call', 'message', 'meeting'];
const CATEGORIES: readonly ProductCategory[] = ['consultation', 'writing', 'package', 'event'];

// The dialogs (and the date picker they use) open on a click: their code is not part of the
// page's first load. It is fetched once the browser is idle, so a click still opens them at once.
const loadLogDialog = () => import('./components/LogDialog');
const loadSellDialog = () => import('./components/SellDialog');
const LogDialog = lazy(() => loadLogDialog().then((module) => ({ default: module.LogDialog })));
const SellDialog = lazy(() => loadSellDialog().then((module) => ({ default: module.SellDialog })));

/**
 * Frame of every customer page: the summary card with its actions, the sub-tabs (summary,
 * purchases, payments, details, application file) and the two dialogs. Canvas "صفحه‌ی مشتری".
 * `?log=call|message|meeting` opens the contact log; `?sell=<category>` the product sale.
 */
export default function CustomerLayout() {
  const { t } = useTranslation('sales');
  const id = useCustomerId();
  const { data } = useSuspenseQuery(customerQuery(id));
  const [params, setParams] = useSearchParams();
  useDocumentTitle(data.name);
  useEffect(
    () =>
      whenIdle(() => {
        void loadLogDialog();
        void loadSellDialog();
      }),
    [],
  );

  const intent = params.get('log');
  const start: LogStart | null = INTENTS.includes(intent as LogIntent)
    ? {
        channel:
          intent === 'message'
            ? ((params.get('channel') as MessageChannel | null) ?? 'whatsapp')
            : intent === 'meeting'
              ? 'meeting'
              : 'call',
        reservation: Number(params.get('reservation')) || undefined,
      }
    : null;
  const sell = params.get('sell');
  const category = CATEGORIES.find((value) => value === sell) ?? null;

  const update = (change: (current: URLSearchParams) => void) =>
    setParams(
      (current) => {
        change(current);
        return current;
      },
      { replace: true },
    );
  const openLog = (channel: LogStart['channel']) =>
    update((current) => {
      current.set('log', channel === 'call' || channel === 'meeting' ? channel : 'message');
      if (channel !== 'call' && channel !== 'meeting') current.set('channel', channel);
    });
  const closeLog = () =>
    update((current) => {
      for (const key of ['log', 'channel', 'reservation']) current.delete(key);
    });

  return (
    <PageStack>
      <BackLink to={salesPath('leads')}>{t('customer.back')}</BackLink>
      <CustomerHero
        customer={data}
        onLog={openLog}
        onSell={() => update((current) => current.set('sell', 'consultation'))}
      />
      <CustomerTabs customer={data} />
      {/* Tab data must not hold up the customer actions or the contact dialog. */}
      <Suspense fallback={<PageSkeleton kind="tab" />}>
        <Outlet />
      </Suspense>
      {/* Keyed by what opened it, so a new intent starts a fresh form. */}
      <Suspense fallback={null}>
        {start && (
          <LogDialog
            key={`log-${start.channel}-${String(start.reservation ?? '')}`}
            customer={data}
            start={start}
            onClose={closeLog}
          />
        )}
        {category && (
          <SellDialog
            customer={data}
            category={category}
            onClose={() => update((current) => current.delete('sell'))}
          />
        )}
      </Suspense>
    </PageStack>
  );
}
