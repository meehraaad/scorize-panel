import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { TogglePill } from '@/components/ui/Choices';
import { Dialog } from '@/components/ui/Dialog';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { useUser } from '@/lib/auth/session';
import { toast } from '@/lib/toast';
import { groupsQuery, keysQuery, useSavePerson, type AccessPerson } from '../api';
import { KeyPicker } from './KeyPicker';

const same = (a: ReadonlySet<unknown>, b: readonly unknown[]) =>
  a.size === b.length && b.every((item) => a.has(item));

/**
 * One person's access: their groups (each brings its keys) and the keys given to them directly. A
 * superuser holds every key, so their groups and keys are kept but not shown; who is a superuser is
 * only changed in Django admin.
 */
export function PersonDialog({ person, onClose }: { person: AccessPerson; onClose: () => void }) {
  const { t } = useTranslation('access');
  const keys = useQuery(keysQuery());
  const groups = useQuery(groupsQuery);
  const save = useSavePerson(person.id);
  const me = useUser();
  // HR (not a superuser): no protected keys or groups, read-only for
  // superusers and themselves (the API refuses the same).
  const limited = !me.is_superuser;
  const editable = person.editable !== false;
  const superuser = person.is_superuser;
  const [chosenGroups, setChosenGroups] = useState(() => new Set(person.groups));
  const [direct, setDirect] = useState(() => new Set(person.keys));

  const groupNames = new Map<string, string[]>();
  for (const group of groups.data ?? []) {
    if (!chosenGroups.has(group.id)) continue;
    for (const key of group.keys) groupNames.set(key, [...(groupNames.get(key) ?? []), group.name]);
  }
  const viaGroups = new Map(
    [...groupNames].map(([key, names]) => [
      key,
      t('person.viaGroup', { group: names.join(t('separator')) }),
    ]),
  );
  const fixedKeys = new Map(
    (keys.data?.keys ?? [])
      .filter((key) => !editable || (limited && key.protected))
      .map((key) => [key.id, t(editable ? 'person.superusersOnly' : 'person.notYours')]),
  );
  const changed =
    !superuser && (!same(chosenGroups, person.groups) || !same(direct, person.keys));

  const submit = () =>
    save.mutate(
      { groups: [...chosenGroups], keys: [...direct] },
      {
        onSuccess: () => {
          toast.success(t('person.saved', { name: person.name }));
          onClose();
        },
        onError: () => toast.error(t('saveError')),
      },
    );

  return (
    <Dialog
      open
      onClose={onClose}
      title={person.name}
      subtitle={[person.team, person.email].filter(Boolean).join(' · ') || undefined}
      closeLabel={t('close')}
      footer={
        editable && !superuser ? (
          <Button disabled={!changed || save.isPending} onClick={submit}>
            {t('save')}
          </Button>
        ) : undefined
      }
    >
      {!editable && !person.is_superuser && (
        <p className="m-0 text-[15px] leading-7">{t('person.lockedForYou')}</p>
      )}
      {superuser ? (
        <p className="m-0 text-[15px] leading-7">{t('person.superuser')}</p>
      ) : !keys.data || !groups.data ? (
        <SkeletonRows rows={4} />
      ) : (
        <>
          <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
            <legend className="mb-3 p-0 text-base font-bold">{t('person.groups')}</legend>
            {groups.data.length === 0 ? (
              <p className="m-0 text-sm text-text-2">{t('person.noGroups')}</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {groups.data.map((group) => (
                  <TogglePill
                    key={group.id}
                    label={group.name}
                    disabled={!editable || (limited && group.protected === true)}
                    checked={chosenGroups.has(group.id)}
                    onChange={(on) => {
                      const next = new Set(chosenGroups);
                      if (on) next.add(group.id);
                      else next.delete(group.id);
                      setChosenGroups(next);
                    }}
                  />
                ))}
              </div>
            )}
          </fieldset>
          <KeyPicker
            label={t('person.keys')}
            areas={keys.data.areas}
            keys={keys.data.keys}
            selected={direct}
            onChange={setDirect}
            locked={viaGroups}
            fixed={fixedKeys}
          />
        </>
      )}
    </Dialog>
  );
}
