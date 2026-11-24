import { useSuspenseQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChoiceGroup } from '@/components/ui/Choices';
import { OrderDetails } from '@/features/writer/OrderPage';
import { orderQuery } from '@/features/writer/api';
import type { CustomerWorkspace } from './api';

export function CustomerWritingDesk({ orders }: { orders: CustomerWorkspace['writing'] }) {
  const { t } = useTranslation(['writer', 'executive']);
  const [selected, setSelected] = useState<string | null>(null);
  const id = orders.find((order) => String(order.id) === selected)?.id ?? orders[0]?.id;
  if (!id) return null;
  return (
    <>
      {orders.length > 1 && (
        <ChoiceGroup
          legend={t('executive:writing')}
          hideLegend
          value={String(id)}
          options={orders.map((order) => ({
            value: String(order.id),
            label: t(`type.${order.kind}`),
          }))}
          onChange={setSelected}
        />
      )}
      <Order id={id} key={id} />
    </>
  );
}

function Order({ id }: { id: number }) {
  const { data } = useSuspenseQuery(orderQuery(id));
  return <OrderDetails order={data} formFirst />;
}
