import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { useUser } from '@/lib/auth/session';
import type { AccessPerson } from '../api';
import { usePersonAccess } from '@/components/access/PersonAccess';
import { useSectionsAccess } from '@/components/access/SectionsAccess';

type Form = ReturnType<typeof useSectionsAccess>;

/**
 * One person's access in a dialog (the access pages): their sections (`useSectionsAccess`). A
 * superuser can open «پیشرفته» for the raw groups and keys underneath (`usePersonAccess`).
 */
export function PersonDialog({ person, onClose }: { person: AccessPerson; onClose: () => void }) {
  const [advanced, setAdvanced] = useState(false);
  const me = useUser();
  const toggle = me.is_superuser ? () => setAdvanced(!advanced) : undefined;
  return advanced ? (
    <Advanced person={person} onClose={onClose} onToggle={toggle} />
  ) : (
    <Sections person={person} onClose={onClose} onToggle={toggle} />
  );
}

interface Props {
  person: AccessPerson;
  onClose: () => void;
  onToggle: (() => void) | undefined;
}

function Sections({ person, onClose, onToggle }: Props) {
  return (
    <Shell person={person} onClose={onClose} form={useSectionsAccess(person, onClose)}>
      {onToggle && <ModeLink advanced={false} onToggle={onToggle} />}
    </Shell>
  );
}

function Advanced({ person, onClose, onToggle }: Props) {
  return (
    <Shell person={person} onClose={onClose} form={usePersonAccess(person, onClose)}>
      {onToggle && <ModeLink advanced onToggle={onToggle} />}
    </Shell>
  );
}

function ModeLink({ advanced, onToggle }: { advanced: boolean; onToggle: () => void }) {
  const { t } = useTranslation('access');
  return (
    <Button variant="quiet" onClick={onToggle}>
      {t(advanced ? 'sections.backToSections' : 'sections.advanced')}
    </Button>
  );
}

function Shell({
  person,
  onClose,
  form,
  children,
}: {
  person: AccessPerson;
  onClose: () => void;
  form: Form;
  children: ReactNode;
}) {
  const { t } = useTranslation('access');
  return (
    <Dialog
      open
      onClose={onClose}
      title={person.name}
      subtitle={[person.team, person.email].filter(Boolean).join(' · ') || undefined}
      closeLabel={t('close')}
      footer={
        form.canSave || children ? (
          <div className="flex w-full flex-wrap items-center justify-between gap-3">
            {children ?? <span />}
            {form.canSave && (
              <Button disabled={!form.changed || form.pending} onClick={form.submit}>
                {t('save')}
              </Button>
            )}
          </div>
        ) : undefined
      }
    >
      {form.fields}
    </Dialog>
  );
}
