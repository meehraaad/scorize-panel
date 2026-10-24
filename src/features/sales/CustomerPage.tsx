import { useSuspenseQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useParams, useSearchParams } from 'react-router';
import { BackLink } from '@/components/ui/BackLink';
import { PageColumns, PageStack } from '@/components/ui/PageColumns';
import { useDocumentTitle } from '@/lib/useDocumentTitle';
import type { MessageChannel } from '@/lib/sales/api';
import { customerQuery } from './api';
import { CustomerAside } from './components/CustomerAside';
import { CustomerHero } from './components/CustomerHero';
import { CustomerTasks } from './components/CustomerTasks';
import { HistoryCard } from './components/HistoryCard';
import { LogDialog, type LogStart } from './components/LogDialog';
import { salesPath, type LogIntent } from './paths';

const INTENTS: readonly LogIntent[] = ['call', 'message', 'meeting'];

/**
 * One customer at a glance: profile, automatic score, history, tasks, and the quick call log.
 * Canvas "صفحه‌ی مشتری". `?log=call|message|meeting` opens the log (from "Call" buttons elsewhere).
 */
export default function CustomerPage() {
  const { t } = useTranslation('sales');
  const id = Number(useParams().id);
  const { data } = useSuspenseQuery(customerQuery(id));
  const [params, setParams] = useSearchParams();
  useDocumentTitle(data.name);

  const intent = params.get('log');
  const reservation = Number(params.get('reservation')) || undefined;
  const start: LogStart | null = INTENTS.includes(intent as LogIntent)
    ? {
        channel:
          intent === 'message'
            ? ((params.get('channel') as MessageChannel | null) ?? 'whatsapp')
            : intent === 'meeting'
              ? 'meeting'
              : 'call',
        reservation,
      }
    : null;

  const openLog = (channel: LogStart['channel']) =>
    setParams(
      (current) => {
        current.set('log', channel === 'call' || channel === 'meeting' ? channel : 'message');
        if (channel !== 'call' && channel !== 'meeting') current.set('channel', channel);
        return current;
      },
      { replace: true },
    );
  const closeLog = () =>
    setParams(
      (current) => {
        for (const key of ['log', 'channel', 'reservation']) current.delete(key);
        return current;
      },
      { replace: true },
    );

  return (
    <PageStack>
      <BackLink to={salesPath('leads')}>{t('customer.back')}</BackLink>
      <CustomerHero customer={data} onLog={openLog} />
      <CustomerTasks customer={data} />
      <PageColumns
        asideLabel={t('customer.summary')}
        main={<HistoryCard customer={data.id} />}
        aside={<CustomerAside customer={data} />}
      />
      {/* Keyed by what opened it, so a new intent starts a fresh form. */}
      <LogDialog
        key={start ? `${start.channel}-${String(start.reservation ?? '')}` : 'closed'}
        customer={data}
        start={start}
        onClose={closeLog}
      />
    </PageStack>
  );
}
