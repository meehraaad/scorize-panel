import type { ComponentProps } from 'react';
import { openContactLog, type LogStart } from '@/lib/sales/contactDrafts';

/** Opens the persistent contact form without changing the current route. */
export function ContactLogButton({
  customer,
  name = '',
  start,
  ...props
}: {
  customer: number;
  name?: string;
  start: LogStart;
} & Omit<ComponentProps<'button'>, 'onClick'>) {
  return <button {...props} type="button" onClick={() => openContactLog(customer, name, start)} />;
}
