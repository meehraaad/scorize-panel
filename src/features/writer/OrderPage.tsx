import { useSuspenseQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useSearchParams } from 'react-router';
import { BackLink } from '@/components/ui/BackLink';
import { PageColumns, PageStack } from '@/components/ui/PageColumns';
import { openOrderChat } from '@/lib/supervisor/caseChats';
import { useDocumentTitle } from '@/lib/useDocumentTitle';
import { orderQuery, type OrderData } from './api';
import { ApplicantForm } from './components/ApplicantForm';
import { OrderSide } from './components/OrderSide';
import { OrderSummary } from './components/OrderSummary';
import { Versions } from './components/Versions';
import { useOrderText } from './components/useOrderText';
import { WRITING_QUEUE } from './paths';

/**
 * One writing order: the drafts sent and the applicant's revision requests, sending the next
 * version or the final file, and the applicant's form, read-only. The program's rules, the
 * case's files and the latest messages on the side.
 * Design: canvas V8 "نگارش · یک سفارش (نسخه‌ها و اصلاح)" (WriterOrder).
 */
export default function OrderPage() {
  const { t } = useTranslation('writer');
  const id = Number(useParams().id);
  const { data } = useSuspenseQuery(orderQuery(id));
  const [search, setSearch] = useSearchParams();
  const showChat = search.get('chat') === '1';
  const {
    type,
    applicant: { name },
  } = data;
  const { typeName } = useOrderText();
  useDocumentTitle(t('order.title', { type: typeName(type), name }));

  useEffect(() => {
    if (!showChat) return;
    openOrderChat(id, name, `writing/${type}`);
    const next = new URLSearchParams(search);
    next.delete('chat');
    setSearch(next, { replace: true });
  }, [id, name, type, showChat, search, setSearch]);

  return (
    <PageStack>
      <BackLink to={WRITING_QUEUE}>{t('order.back')}</BackLink>
      <OrderDetails order={data} />
    </PageStack>
  );
}

export function OrderDetails({
  order: data,
  formFirst = false,
}: {
  order: OrderData;
  formFirst?: boolean;
}) {
  const { t } = useTranslation('writer');
  return (
    <PageStack>
      <OrderSummary order={data} />
      <PageColumns
        asideLabel={t('order.side')}
        main={
          <>
            {formFirst && <ApplicantForm form={data.form} />}
            <Versions order={data} />
            {!formFirst && <ApplicantForm form={data.form} />}
          </>
        }
        aside={<OrderSide order={data} />}
      />
    </PageStack>
  );
}
