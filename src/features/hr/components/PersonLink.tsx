import { Link } from 'react-router';
import { Avatar } from '@/components/ui/Avatar';
import { FaceDot } from '@/components/customers/FaceDot';
import type { Face } from '@/lib/face/api';
import { personPath } from '../paths';

/** A staff member's name with their face (or first letter), linking to their file. */
export function PersonLink({
  id,
  name,
  face,
  sub,
}: {
  id: number;
  name: string;
  face?: Face | null;
  sub?: string;
}) {
  return (
    <Link
      to={personPath(id)}
      className="flex min-h-11 min-w-0 items-center gap-3 rounded-xl text-start hover:text-primary-text focus-visible:outline-2 focus-visible:outline-focus"
    >
      {face ? <FaceDot name={name} face={face} /> : <Avatar name={name} size="sm" />}
      <span className="flex min-w-0 flex-col">
        <span className="truncate font-semibold">{name}</span>
        {sub && <span className="truncate text-xs text-text-2">{sub}</span>}
      </span>
    </Link>
  );
}
