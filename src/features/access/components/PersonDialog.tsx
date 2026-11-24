import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import type { AccessPerson } from '../api';
import { usePersonAccess } from '@/components/access/PersonAccess';

/** One person's access in a dialog (the access pages): see `usePersonAccess`. */
export function PersonDialog({ person, onClose }: { person: AccessPerson; onClose: () => void }) {
  const { t } = useTranslation('access');
  const access = usePersonAccess(person, onClose);
  return (
    <Dialog
      open
      onClose={onClose}
      title={person.name}
      subtitle={[person.team, person.email].filter(Boolean).join(' · ') || undefined}
      closeLabel={t('close')}
      footer={
        access.canSave ? (
          <Button disabled={!access.changed || access.pending} onClick={access.submit}>
            {t('save')}
          </Button>
        ) : undefined
      }
    >
      {access.fields}
    </Dialog>
  );
}
