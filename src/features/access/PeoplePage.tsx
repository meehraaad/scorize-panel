import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { SelectField } from '@/components/ui/Choices';
import { EmptyState } from '@/components/ui/EmptyState';
import { SearchField } from '@/components/ui/Filters';
import { Icon } from '@/components/ui/Icon';
import { PageStack } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pager } from '@/components/ui/Pager';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { pagesOf, useClampPage } from '@/lib/api/page';
import { useFormat } from '@/lib/i18n/useFormat';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import {
  groupsQuery,
  heldKeys,
  keysQuery,
  peopleFilterOf,
  peopleQuery,
  type AccessGroup,
  type AccessPerson,
} from './api';
import { PersonDialog } from './components/PersonDialog';

const ALL = 'all';

/**
 * Who has what: everyone holding a key or a group (superusers first), or the holders of one key or
 * the members of one group. A search also finds staff who hold nothing yet. A row opens the
 * person's groups and keys.
 */
export default function PeoplePage() {
  const { t } = useTranslation('access');
  const f = useFormat();
  const [params, setParams] = useSearchParams();
  const filter = peopleFilterOf(params);
  const [search, setSearch] = useState('');
  const searched = useDebouncedValue(search.trim());
  const page = filter.page ?? 1;
  const people = useQuery(peopleQuery({ ...filter, ...(searched ? { search: searched } : {}) }));
  const keys = useQuery(keysQuery());
  const groups = useQuery(groupsQuery);
  const [open, setOpen] = useState<AccessPerson | null>(null);

  const setFilter = (name: 'key' | 'group' | 'page', value: string | null) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (value === null) next.delete(name);
        else next.set(name, value);
        if (name !== 'page') next.delete('page');
        return next;
      },
      { replace: true },
    );
  useClampPage(people.data, page, (to) => setFilter('page', to > 1 ? String(to) : null));

  const keyLabel = (id: string) => keys.data?.keys.find((key) => key.id === id)?.label ?? id;

  return (
    <PageStack>
      <PageHeader title={t('people.title')} subtitle={t('people.subtitle')} />
      <div className="flex flex-wrap items-end gap-3">
        <SearchField
          label={t('people.search')}
          placeholder={t('people.searchPlaceholder')}
          value={search}
          onChange={(value) => {
            setSearch(value);
            if (page > 1) setFilter('page', null);
          }}
        />
        <SelectField
          inline
          label={t('people.byGroup')}
          value={filter.group === undefined ? ALL : String(filter.group)}
          onChange={(value) => setFilter('group', value === ALL ? null : value)}
          options={[
            { value: ALL, label: t('people.anyGroup') },
            ...(groups.data ?? []).map((group) => ({ value: String(group.id), label: group.name })),
          ]}
        />
        {filter.key && (
          <button
            type="button"
            onClick={() => setFilter('key', null)}
            aria-label={t('people.clearKey', { key: keyLabel(filter.key) })}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-tint px-4 text-sm font-medium text-primary-text"
          >
            {t('people.withKey', { key: keyLabel(filter.key) })}
            <Icon name="close" size={16} />
          </button>
        )}
      </div>
      <Card aria-label={t('people.list')} aria-busy={!people.data}>
        {!people.data ? (
          <SkeletonRows rows={5} />
        ) : people.data.results.length === 0 ? (
          <EmptyState variant="padded">
            {t(searched ? 'people.nobodyFound' : 'people.empty')}
          </EmptyState>
        ) : (
          <ul className="m-0 list-none p-0">
            {people.data.results.map((person, index) => (
              <li key={person.id}>
                <PersonRow
                  person={person}
                  groups={groups.data ?? []}
                  first={index === 0}
                  onOpen={() => setOpen(person)}
                />
              </li>
            ))}
          </ul>
        )}
        {people.data && people.data.count > people.data.page_size && (
          <Pager
            status={t('people.count', { count: people.data.count, n: f.number(people.data.count) })}
            page={page}
            pages={pagesOf(people.data)}
            pending={people.isFetching}
            onPage={(to) => setFilter('page', to > 1 ? String(to) : null)}
          />
        )}
      </Card>
      {open && <PersonDialog person={open} onClose={() => setOpen(null)} />}
    </PageStack>
  );
}

function PersonRow({
  person,
  groups,
  first,
  onOpen,
}: {
  person: AccessPerson;
  groups: readonly AccessGroup[];
  first: boolean;
  onOpen: () => void;
}) {
  const { t } = useTranslation('access');
  const f = useFormat();
  const held = heldKeys(person, groups).size;
  const memberOf = groups.filter((group) => person.groups.includes(group.id));
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={t('people.open', { name: person.name })}
      className={`flex w-full flex-wrap items-center gap-x-4 gap-y-1.5 px-5 py-3.5 text-start hover:bg-canvas lg:px-8 ${
        first ? '' : 'shadow-[inset_0_1px_0_var(--hair)]'
      }`}
    >
      <span className="flex min-w-0 flex-[1_1_220px] flex-col gap-0.5">
        <span className="text-[15px] font-semibold">{person.name}</span>
        <span className="truncate text-[13px] text-text-2">{person.team ?? person.email}</span>
      </span>
      <span className="flex flex-[1_1_260px] flex-wrap items-center gap-1.5">
        {person.is_superuser ? (
          <Chip tone="primary" small>
            {t('people.superuser')}
          </Chip>
        ) : (
          <>
            {memberOf.map((group) => (
              <Chip key={group.id} tone="info" small>
                {group.name}
              </Chip>
            ))}
            <span className="text-[13px] text-text-2">
              {held === 0
                ? t('people.noKeys')
                : t('people.keys', { count: held, n: f.number(held) })}
            </span>
          </>
        )}
      </span>
      <Icon name="chevronEnd" size={18} className="text-text-3" />
    </button>
  );
}
