import { keepPreviousData, useQuery } from '@tanstack/react-query';
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
  keysQuery,
  peopleFilterOf,
  peopleQuery,
  sectionsQuery,
  WRITE_SECTION,
  type AccessPerson,
  type SectionList,
} from './api';
import { PersonDialog } from './components/PersonDialog';

const ALL = 'all';

/**
 * Who has what, in sections: everyone holding something (the board first), a team's people, or
 * who has one section (the keys and groups pages still link here by key or group). A search also
 * finds staff who hold nothing yet. A row shows the person's sections; it opens them as switches.
 */
export default function PeoplePage() {
  const { t } = useTranslation('access');
  const f = useFormat();
  const [params, setParams] = useSearchParams();
  const filter = peopleFilterOf(params);
  const [search, setSearch] = useState('');
  const searched = useDebouncedValue(search.trim());
  const page = filter.page ?? 1;
  // Filters, search and paging keep the current rows until the new ones arrive (no skeleton flash).
  const people = useQuery({
    ...peopleQuery({ ...filter, ...(searched ? { search: searched } : {}) }),
    placeholderData: keepPreviousData,
  });
  const sections = useQuery(sectionsQuery);
  // Only to name the key the keys page linked here with.
  const keys = useQuery({ ...keysQuery(), enabled: Boolean(filter.key) });
  const [open, setOpen] = useState<AccessPerson | null>(null);

  const setFilter = (name: 'key' | 'group' | 'section' | 'team' | 'page', value: string | null) =>
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

  const clearable = filter.key ?? (filter.group !== undefined ? String(filter.group) : null);

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
          label={t('people.byTeam')}
          value={filter.team === undefined ? ALL : String(filter.team)}
          onChange={(value) => setFilter('team', value === ALL ? null : value)}
          options={[
            { value: ALL, label: t('people.anyTeam') },
            ...(sections.data?.teams ?? []).map((team) => ({
              value: String(team.id),
              label: team.label,
            })),
          ]}
        />
        <SelectField
          inline
          label={t('people.bySection')}
          value={filter.section ?? ALL}
          onChange={(value) => setFilter('section', value === ALL ? null : value)}
          options={[
            { value: ALL, label: t('people.anySection') },
            ...(sections.data?.sections ?? []).map((section) => ({
              value: section.id,
              label: section.label,
            })),
          ]}
        />
        {clearable !== null && (
          <button
            type="button"
            onClick={() =>
              setParams(
                (current) => {
                  const next = new URLSearchParams(current);
                  for (const name of ['key', 'group', 'page']) next.delete(name);
                  return next;
                },
                { replace: true },
              )
            }
            aria-label={t('people.clearFilter')}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-tint px-4 text-sm font-medium text-primary-text"
          >
            {t(filter.key ? 'people.withKey' : 'people.inGroup', {
              key: keys.data?.keys.find((key) => key.id === filter.key)?.label ?? filter.key,
            })}
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
                  sections={sections.data}
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
  sections,
  first,
  onOpen,
}: {
  person: AccessPerson;
  sections: SectionList | undefined;
  first: boolean;
  onOpen: () => void;
}) {
  const { t } = useTranslation('access');
  const write = sections?.sections.find((section) => section.id === WRITE_SECTION);
  const label = (id: string) => {
    const section = sections?.sections.find((one) => one.id === id);
    if (!section) return id;
    const kinds = person.writing ?? [];
    // Some kinds of writing, not all: name them («نوشتن: رزومه»).
    if (id === WRITE_SECTION && write && kinds.length < write.options.length)
      return t('people.writeKinds', {
        kinds: write.options
          .filter((option) => kinds.includes(option.id))
          .map((option) => option.label)
          .join(t('separator')),
      });
    return section.label;
  };
  const on = person.sections ?? [];
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
        <span className="text-body font-semibold">{person.name}</span>
        <span className="truncate text-label text-text-2">{person.team ?? person.email}</span>
      </span>
      <span className="flex flex-[1_1_320px] flex-wrap items-center gap-1.5">
        {person.is_superuser ? (
          <Chip tone="primary" small>
            {t('people.board')}
          </Chip>
        ) : on.length > 0 ? (
          on.map((id) => (
            <Chip key={id} tone="info" small>
              {label(id)}
            </Chip>
          ))
        ) : (
          <span className="text-label text-text-2">{t('people.baseOnly')}</span>
        )}
      </span>
      <Icon name="chevronEnd" size={18} className="text-text-3" />
    </button>
  );
}
