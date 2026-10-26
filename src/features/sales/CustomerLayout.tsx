import { useSuspenseQuery } from '@tanstack/react-query';
import { Suspense, lazy, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet, useSearchParams } from 'react-router';
import { BackLink } from '@/components/ui/BackLink';
import { PageStack } from '@/components/ui/PageColumns';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { useDocumentTitle } from '@/lib/useDocumentTitle';
import { whenIdle } from '@/lib/whenIdle';
import { openContactLog } from '@/lib/sales/contactDrafts';
import type { Channel } from '@/lib/sales/api';
import { customerQuery, type ProductCategory } from './api';
import { CustomerHero } from './components/CustomerHero';
import { CustomerTabs } from './components/CustomerTabs';
import { salesPath, type LogIntent } from './paths';
import { useCustomerId } from './useCustomerId';

const INTENTS: readonly LogIntent[] = ['call', 'message', 'meeting'];
const CATEGORIES: readonly ProductCategory[] = ['consultation', 'writing', 'package', 'event'];

// The dialogs (and the date picker they use) open on a click: their code is not part of the
// page's first load. It is fetched once the browser is idle, so a click still opens them at once.
const loadSellDialog = () => import('./components/SellDialog');
const SellDialog = lazy(() => loadSellDialog().then((module) => ({ default: module.SellDialog })));

/**
 * Frame of every customer page: the summary card with its actions, the sub-tabs (summary,
 * purchases, payments, details, application file) and the product-sale dialog. Canvas "صفحه‌ی مشتری".
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
        void loadSellDialog();
      }),
    [],
  );

  // Preserve old deep links, then remove their intent so back/forward cannot reopen a saved log.
  const intent = params.get('log');
  const channel = params.get('channel');
  const reservation = params.get('reservation');
  useEffect(() => {
    if (!INTENTS.includes(intent as LogIntent)) return;
    const messageChannel = channel === 'telegram' || channel === 'sms' ? channel : 'whatsapp';
    openContactLog(id, data.name, {
      channel: intent === 'message' ? messageChannel : intent === 'meeting' ? 'meeting' : 'call',
      reservation: Number(reservation) || undefined,
    });
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        for (const key of ['log', 'channel', 'reservation']) next.delete(key);
        return next;
      },
      { replace: true },
    );
  }, [intent, channel, reservation, id, data.name, setParams]);
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
  const openLog = (channel: Channel) => openContactLog(id, data.name, { channel });

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
      {/* Product sales remain local to the customer page. */}
      <Suspense fallback={null}>
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
