import { Link } from 'react-router';
import { Avatar } from '@/components/ui/Avatar';
import { customerWorkDeskPath } from './customer/paths';

export function CustomerName({ name, detail, id }: { name: string; detail?: string; id: number }) {
  return (
    <div className="flex min-w-0 items-center gap-3 text-start">
      <Avatar name={name} shape="rounded" tone="primary" />
      <div className="min-w-0">
        <Link
          to={customerWorkDeskPath(id)}
          className="inline-flex min-h-11 items-center rounded-lg font-bold wrap-anywhere hover:text-primary-text hover:underline"
        >
          {name}
        </Link>
        {detail && <div className="text-label font-normal text-text-2">{detail}</div>}
      </div>
    </div>
  );
}
