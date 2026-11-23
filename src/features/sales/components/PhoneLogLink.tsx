import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Icon } from '@/components/ui/Icon';
import { useFormat } from '@/lib/i18n/useFormat';
import { maskPhone } from '@/lib/sales/api';
import { customerPath } from '../paths';

/**
 * The customer's masked number ("0912 ••• 4418"), as a link that opens the call log on their
 * page (`?log=call`): the log shows the whole number and the call button.
 */
export function PhoneLogLink({
  customer,
  phone,
  name,
  className = '',
}: {
  /** The customer's (user) id. */
  customer: number;
  phone: string;
  /** Their display name, for the link's label. */
  name: string;
  className?: string;
}) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  if (!phone) return null;
  const masked = f.digits(maskPhone(phone));
  return (
    <Link
      to={`${customerPath(customer)}?log=call`}
      aria-label={t('phoneLog.open', { name, phone: masked })}
      title={t('phoneLog.hint')}
      className={`-my-2 inline-flex min-h-11 items-center gap-1 font-semibold text-primary-text hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${className}`}
    >
      <Icon name="phone" size={14} />
      <span dir="ltr">{masked}</span>
    </Link>
  );
}
