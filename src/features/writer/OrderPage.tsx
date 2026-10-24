import { useSuspenseQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';
import { BackLink } from '@/components/ui/BackLink';
import { PageColumns, PageStack } from '@/components/ui/PageColumns';
import { useDocumentTitle } from '@/lib/useDocumentTitle';
import { orderQuery } from './api';
import { ApplicantForm } from './components/ApplicantForm';
import { OrderSide } from './components/OrderSide';
import { OrderSummary } from './components/OrderSummary';
import { Versions } from './components/Versions';
import { useOrderText } from './components/useOrderText';
import { WRITER_ROOT } from './paths';

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
  const { typeName } = useOrderText();
  useDocumentTitle(t('order.title', { type: typeName(data.type), name: data.applicant.name }));

  return (
    <PageStack>
      <BackLink to={WRITER_ROOT}>{t('order.back')}</BackLink>
      <OrderSummary order={data} />
      <PageColumns
        asideLabel={t('order.side')}
        main={
          <>
            <Versions order={data} />
            <ApplicantForm form={data.form} />
          </>
        }
        aside={<OrderSide order={data} />}
      />
    </PageStack>
  );
}
