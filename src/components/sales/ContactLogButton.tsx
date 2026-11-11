import type { ComponentProps } from 'react';
import { openContactLog, type LogStart } from '@/lib/sales/contactDrafts';
import { dialWithLinphone } from '@/lib/sales/dial';

/** Opens the persistent contact form without changing the current route. */
export function ContactLogButton({
  customer,
  name = '',
  start,
  phone,
  ...props
}: {
  customer: number;
  name?: string;
  start: LogStart;
  /** For a call: the number Linphone dials at once, when it's on for this device. */
  phone?: string;
} & Omit<ComponentProps<'button'>, 'onClick'>) {
  return (
    <button
      {...props}
      type="button"
      onClick={() => {
        openContactLog(customer, name, start);
        if (start.channel === 'call') dialWithLinphone(phone);
      }}
    />
  );
}
