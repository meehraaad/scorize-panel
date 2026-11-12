import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { SearchField } from '@/components/ui/Filters';
import { InlineConfirm } from '@/components/ui/InlineConfirm';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { TextField } from '@/components/ui/TextField';
import { ApiError } from '@/lib/api/client';
import { useFormat } from '@/lib/i18n/useFormat';
import { useUser } from '@/lib/auth/session';
import { toast } from '@/lib/toast';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import {
  keysQuery,
  peopleQuery,
  useAddGroup,
  useAddMember,
  useDeleteGroup,
  useRemoveMember,
  useSaveGroup,
  type AccessGroup,
  type AccessPerson,
} from '../api';
import { KeyPicker } from './KeyPicker';

/** Django's own words for an invalid field (`{"name": ["…"]}`), if it sent any. */
function fieldError(error: unknown, field: string): string | undefined {
  if (!(error instanceof ApiError) || error.status !== 400) return undefined;
  const value = (error.body as Record<string, unknown> | null)?.[field];
  return Array.isArray(value) && typeof value[0] === 'string' ? value[0] : undefined;
}

/**
 * A new group, or one to rename, change the keys of, add people to or take people out of, or
 * delete. A group the system keeps (Founders) changes only its members.
 */
export function GroupDialog({
  group,
  onClose,
}: {
  group: AccessGroup | null;
  onClose: () => void;
}) {
  const { t } = useTranslation('access');
  const keys = useQuery(keysQuery());
  const add = useAddGroup();
  const saveExisting = useSaveGroup(group?.id ?? 0);
  const remove = useDeleteGroup(group?.id ?? 0);
  const save = group ? saveExisting : add;
  const [name, setName] = useState(group?.name ?? '');
  const [chosen, setChosen] = useState(() => new Set(group?.keys ?? []));
  const [confirmDelete, setConfirmDelete] = useState(false);
  const superuser = useUser().is_superuser;
  // Kept by the system, or opened by HR: only its members can change here.
  const fixed = (group?.system ?? false) || !superuser;

  const changed =
    !group ||
    name.trim() !== group.name ||
    chosen.size !== group.keys.length ||
    group.keys.some((key) => !chosen.has(key));

  const submit = () =>
    save.mutate(
      { name: name.trim(), keys: [...chosen] },
      {
        onSuccess: () => {
          toast.success(t(group ? 'groups.saved' : 'groups.added', { name: name.trim() }));
          onClose();
        },
        onError: (error) => {
          if (!fieldError(error, 'name')) toast.error(t('saveError'));
        },
      },
    );

  return (
    <Dialog
      open
      onClose={onClose}
      title={group ? group.name : t('groups.new')}
      subtitle={group ? t('groups.subtitle') : t('groups.newSubtitle')}
      closeLabel={t('close')}
      footer={
        fixed ? undefined : (
          <Button disabled={!changed || !name.trim() || save.isPending} onClick={submit}>
            {t(group ? 'save' : 'groups.addButton')}
          </Button>
        )
      }
    >
      {fixed ? (
        <p className="m-0 text-[15px] leading-7">
          {t(group?.system ? 'groups.system' : 'groups.superusersKeys')}
        </p>
      ) : (
        <TextField
          label={t('groups.name')}
          hint={t('groups.nameHint')}
          error={fieldError(save.error, 'name')}
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={150}
        />
      )}
      {group && <Members group={group} />}
      {!keys.data ? (
        <SkeletonRows rows={4} />
      ) : fixed ? (
        <section aria-label={t('groups.keys')} className="flex flex-col gap-2">
          <h3 className="m-0 text-base font-bold">{t('groups.keys')}</h3>
          <ul className="m-0 flex list-disc flex-col gap-1 ps-5 text-[15px]">
            {group?.keys.map((id) => (
              <li key={id}>{keys.data.keys.find((key) => key.id === id)?.label ?? id}</li>
            ))}
          </ul>
        </section>
      ) : (
        <KeyPicker
          label={t('groups.keys')}
          areas={keys.data.areas}
          keys={keys.data.keys}
          selected={chosen}
          onChange={setChosen}
        />
      )}
      {group &&
        !fixed &&
        (confirmDelete ? (
          <InlineConfirm
            message={t('groups.deleteConfirm', { name: group.name, count: group.members })}
            confirmLabel={t('groups.deleteButton')}
            cancelLabel={t('cancel')}
            pending={remove.isPending}
            onCancel={() => setConfirmDelete(false)}
            onConfirm={() =>
              remove.mutate(undefined, {
                onSuccess: () => {
                  toast.success(t('groups.deleted', { name: group.name }));
                  onClose();
                },
                onError: () => toast.error(t('saveError')),
              })
            }
          />
        ) : (
          <Button variant="danger" className="self-start" onClick={() => setConfirmDelete(true)}>
            {t('groups.delete')}
          </Button>
        ))}
    </Dialog>
  );
}

/** The group's people (each can be taken out) and a search to add someone. */
function Members({ group }: { group: AccessGroup }) {
  const { t } = useTranslation('access');
  // HR changes neither a protected group's people nor a superuser's or their own membership.
  const open = useUser().is_superuser || !group.protected;
  const f = useFormat();
  const members = useQuery(peopleQuery({ group: group.id }));
  const [search, setSearch] = useState('');
  const searched = useDebouncedValue(search.trim());
  const found = useQuery({ ...peopleQuery({ search: searched }), enabled: searched.length >= 2 });
  const addMember = useAddMember(group.id);
  const removeMember = useRemoveMember(group.id);
  const inGroup = new Set(members.data?.results.map((person) => person.id));

  const addPerson = (person: AccessPerson) =>
    addMember.mutate(person.id, {
      onSuccess: () => {
        toast.success(t('groups.memberAdded', { name: person.name, group: group.name }));
        setSearch('');
      },
      onError: () => toast.error(t('saveError')),
    });
  const removePerson = (person: AccessPerson) =>
    removeMember.mutate(person.id, {
      onSuccess: () =>
        toast.success(t('groups.memberRemoved', { name: person.name, group: group.name })),
      onError: () => toast.error(t('saveError')),
    });

  return (
    <section aria-label={t('groups.members')} className="flex flex-col gap-3">
      <h3 className="m-0 text-base font-bold">
        {t('groups.membersCount', {
          count: members.data?.count ?? group.members,
          n: f.number(members.data?.count ?? group.members),
        })}
      </h3>
      {!members.data ? (
        <SkeletonRows rows={2} />
      ) : members.data.results.length === 0 ? (
        <p className="m-0 text-sm text-text-2">{t('groups.noMembers')}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col p-0">
          {members.data.results.map((person) => (
            <li key={person.id} className="flex min-h-12 items-center justify-between gap-3">
              <span className="flex min-w-0 flex-col">
                <span className="text-[15px] font-medium">{person.name}</span>
                {person.team && <span className="text-[13px] text-text-2">{person.team}</span>}
              </span>
              {open && person.editable !== false && (
                <Button
                  variant="outline"
                  className="h-11 px-4 text-sm"
                  disabled={removeMember.isPending}
                  onClick={() => removePerson(person)}
                  aria-label={t('groups.removeMember', { name: person.name })}
                >
                  {t('groups.remove')}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {!open && <p className="m-0 text-sm text-text-2">{t('groups.protectedMembers')}</p>}
      {open && (
        <SearchField
          label={t('groups.addMember')}
          placeholder={t('groups.addMemberPlaceholder')}
          value={search}
          onChange={setSearch}
          className="flex-none"
        />
      )}
      {open &&
        searched.length >= 2 &&
        (!found.data ? (
          <SkeletonRows rows={2} />
        ) : found.data.results.length === 0 ? (
          <p className="m-0 text-sm text-text-2">{t('people.nobodyFound')}</p>
        ) : (
          <ul className="m-0 flex list-none flex-col p-0">
            {found.data.results.map((person) => (
              <li key={person.id} className="flex min-h-12 items-center justify-between gap-3">
                <span className="flex min-w-0 flex-col">
                  <span className="text-[15px] font-medium">{person.name}</span>
                  <span className="text-[13px] text-text-2">{person.team ?? person.email}</span>
                </span>
                {inGroup.has(person.id) ? (
                  <span className="text-[13px] text-text-2">{t('groups.alreadyIn')}</span>
                ) : person.editable === false ? (
                  <span className="text-[13px] text-text-2">{t('people.locked')}</span>
                ) : (
                  <Button
                    variant="outline"
                    className="h-11 px-4 text-sm"
                    disabled={addMember.isPending}
                    onClick={() => addPerson(person)}
                    aria-label={t('groups.addPerson', { name: person.name })}
                  >
                    {t('groups.add')}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        ))}
    </section>
  );
}
