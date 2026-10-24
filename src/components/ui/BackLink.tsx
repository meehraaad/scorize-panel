import { Link } from 'react-router';
import { Icon } from './Icon';

/** "← Back" above a page title: a quiet link to the page this one belongs to. */
export function BackLink({ to, children }: { to: string; children: string }) {
  return (
    <Link
      to={to}
      className="-my-2 inline-flex min-h-11 items-center gap-1.5 self-start text-sm font-medium text-text-2 hover:text-text"
    >
      <Icon name="chevronStart" size={18} />
      {children}
    </Link>
  );
}
