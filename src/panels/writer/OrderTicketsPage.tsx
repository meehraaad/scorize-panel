import { useSuspenseQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';
import { BackLink } from '@/components/ui/BackLink';
import { PageStack } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import type { TicketsConfig } from '@/features/tickets/config';
import { TicketsPage } from '@/features/tickets/TicketsPage';
import { orderQuery, orderTickets } from '@/features/writer/api';
import { orderPath } from '@/features/writer/paths';

/**
 * A writing order's conversation with the applicant (the order's SopResumeTicket thread): the
 * shared tickets page as staff, under the order's name.
 */
export default function OrderTicketsPage() {
  const { t } = useTranslation('writer');
  const id = Number(useParams().id);
  const { data } = useSuspenseQuery(orderQuery(id));
  const config: TicketsConfig = {
    ...orderTickets(id),
    path: orderPath(id, 'tickets'),
    viewer: 'staff',
  };
  return (
    <PageStack>
      <BackLink to={orderPath(id)}>
        {t('order.title', { type: t(`type.${data.type}`), name: data.applicant.name })}
      </BackLink>
      <PageHeader title={t('chat.title', { name: data.applicant.name })} compact />
      <TicketsPage config={config} embedded />
    </PageStack>
  );
}
