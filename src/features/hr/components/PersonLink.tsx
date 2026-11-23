import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Avatar } from '@/components/ui/Avatar';
import { FaceDot } from '@/components/customers/FaceDot';
import type { Face } from '@/lib/face/api';
import { useFormat } from '@/lib/i18n/useFormat';
import { isPhoneName, waitsForForm } from '../format';
import { personPath } from '../paths';

/**
 * A staff member's name with their face (or first letter), linking to their file. A file still
 * named by its phone (the hire's form isn't approved yet) shows the number and says so.
 */
export function PersonLink({
  id,
  name,
  face,
  sub,
  form,
}: {
  id: number;
  name: string;
  face?: Face | null;
  sub?: string | undefined;
  /** Their open new-hire form, if any: "waiting for the form" while the hire fills it. */
  form?: { status: string } | null | undefined;
}) {
  const { t } = useTranslation('hr');
  const f = useFormat();
  const phoneName = isPhoneName(name);
  const pending = waitsForForm(name, form);
  const line = pending ? [t('onboarding.pending'), sub].filter(Boolean).join(' · ') : sub;
  return (
    <Link
      to={personPath(id)}
      className="flex min-h-11 min-w-0 items-center gap-3 rounded-xl text-start hover:text-primary-text focus-visible:outline-2 focus-visible:outline-focus"
    >
      {face ? <FaceDot name={name} face={face} /> : <Avatar name={name} size="sm" />}
      <span className="flex min-w-0 flex-col">
        <span className="truncate font-semibold">
          {phoneName ? <bdi dir="ltr">{f.digits(name)}</bdi> : name}
        </span>
        {line && <span className="truncate text-xs text-text-2">{line}</span>}
      </span>
    </Link>
  );
}
