import { useSuspenseQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Navigate, useParams } from 'react-router';
import { FaqList } from '@/components/tickets/FaqList';
import { ThreadSwitch } from '@/components/tickets/ThreadTabs';
import { buttonClass } from '@/components/ui/buttonStyles';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import { PageColumns, PageFill, PageStack } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { SheetButton } from '@/components/ui/Sheet';
import { useFormat } from '@/lib/i18n/useFormat';
import { SITE } from '@/lib/site';
import { ticketsQuery, type TicketThread } from '@/lib/tickets/api';
import { ThreadCard } from './components/ThreadCard';
import { findThread, threadPath, type TicketsConfig } from './config';

const DEPARTMENTS = ['supervisor', 'writing'] as const;

/**
 * Tickets: one conversation per department (supervisor; each writing department), switched by
 * address. Design: canvas V6 "تیکت‌ها" and "تیکت نگارش" (AppTickets, AppWTicket).
 */
export function TicketsPage({ config }: { config: TicketsConfig }) {
  const { t } = useTranslation('tickets');
  const f = useFormat();
  const segment = useParams()['*'] ?? '';
  const { data } = useSuspenseQuery(ticketsQuery(config));

  if (!data || data.threads.length === 0)
    return (
      <PageStack>
        <PageHeader title={t('title')} />
        {/* No contract yet. The locked preview for this case is canvas V7, still to come. */}
        <EmptyState
          variant="card"
          action={
            <a href={SITE.consultation} className={buttonClass('primary')}>
              {t('consult')}
            </a>
          }
        >
          {t('noFile')}
        </EmptyState>
      </PageStack>
    );

  const { threads } = data;
  const thread = findThread(threads, segment);
  if (!thread) return <Navigate to={config.path} replace />;

  const unreadIn = (department: TicketThread['department']) =>
    threads
      .filter((item) => item.department === department)
      .reduce((sum, item) => sum + item.unread, 0);
  const departments = DEPARTMENTS.flatMap((department) => {
    const first = threads.find((item) => item.department === department);
    if (!first) return [];
    const active = thread.department === department;
    const unread = unreadIn(department);
    return [
      {
        key: department,
        label: t(`department.${department}`),
        to: threadPath(config, threads, first),
        active,
        badge: !active && unread > 0 ? f.number(unread) : undefined,
      },
    ];
  });
  const faqs = data.faqs.filter((faq) => faq.department === thread.department);

  const hours = (
    <p className="m-0 flex items-start gap-3 text-sm leading-7">
      <Icon name="clock" className="mt-1 flex-none text-primary-text" />
      {t('hours')}
    </p>
  );

  // Phones: a chat screen. The conversation fills the space between the header and the bottom
  // tabs; FAQ and opening hours move into a sheet behind the help button.
  return (
    <PageFill>
      <PageHeader
        compact
        title={t('title')}
        subtitle={t(`subtitle.${thread.department}`)}
        actions={
          <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
            {departments.length > 1 && (
              <ThreadSwitch label={t('departments')} items={departments} />
            )}
            <SheetButton
              icon="help"
              label={t('help')}
              title={t('aside')}
              closeLabel={t('close')}
              className="lg:hidden"
            >
              {faqs.length > 0 && (
                <>
                  <h3 className="m-0 text-base font-bold">{t('faq')}</h3>
                  <FaqList items={faqs} openId={faqs[0]?.id} />
                </>
              )}
              <div className="rounded-2xl bg-canvas p-4">{hours}</div>
            </SheetButton>
          </div>
        }
      />
      <PageColumns
        fill
        asideLabel={t('aside')}
        main={<ThreadCard key={thread.id} config={config} threads={threads} thread={thread} />}
        aside={
          <>
            {faqs.length > 0 && (
              <SectionCard variant="panel" id="tickets-faq" title={t('faq')}>
                <FaqList items={faqs} openId={faqs[0]?.id} />
              </SectionCard>
            )}
            <Card className="p-5 lg:p-6">{hours}</Card>
          </>
        }
      />
    </PageFill>
  );
}
