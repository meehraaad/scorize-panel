import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { useSectionsAccess } from '@/components/access/SectionsAccess';
import type { AccessPerson } from '@/lib/access/api';
import { personQuery } from '@/lib/access/people';
import type { StaffFile } from '../api';

/**
 * The staff file's «دسترسی‌ها» tab: what their team gives them and their sections, switched right
 * here once they are hired (the same form as HR's access section, without searching for them
 * there). Django
 * `access/v1/people/<user>/`, with HR's limits (no superusers, not oneself, no protected keys).
 */
export default function AccessTab({ file }: { file: StaffFile }) {
  const { t } = useTranslation('access');
  const person = useQuery(personQuery(file.user));
  if (person.isPending) return <SkeletonRows rows={4} />;
  if (person.isError) return <EmptyState variant="card">{t('loadError')}</EmptyState>;
  // Keyed by the person: a fresh copy after a save starts the form from what was saved.
  return <PersonAccessCard key={JSON.stringify(person.data)} person={person.data} />;
}

function PersonAccessCard({ person }: { person: AccessPerson }) {
  const { t } = useTranslation('access');
  const access = useSectionsAccess(person);
  return (
    <Card aria-label={t('person.title')} className="flex flex-col gap-5 p-5 lg:p-7">
      {access.fields}
      {access.canSave && (
        <div>
          <Button disabled={!access.changed || access.pending} onClick={access.submit}>
            {t('save')}
          </Button>
        </div>
      )}
    </Card>
  );
}
