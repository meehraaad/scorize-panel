import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { SearchField } from '@/components/ui/Filters';
import { PageStack } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { Switch } from '@/components/ui/Switch';
import { toast } from '@/lib/toast';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import {
  ACCESS_KEYS,
  accessQuery,
  peopleQuery,
  useSetAccess,
  type AccessKey,
  type Holder,
} from './api';

/**
 * Who holds the section's two keys (superusers only): "automatic messages" and "ready messages".
 * A key given through a group, or a superuser's, can't be taken back here.
 */
export default function AccessPage() {
  const { t } = useTranslation('messages');
  const { data: holders } = useSuspenseQuery(accessQuery);
  const [search, setSearch] = useState('');
  const searched = useDebouncedValue(search.trim());
  const people = useQuery(peopleQuery(searched));

  return (
    <PageStack>
      <PageHeader title={t('access.title')} subtitle={t('access.subtitle')} />
      <Card aria-label={t('access.holders')}>
        <h2 className="m-0 px-5 pt-5 text-base font-bold lg:px-8">{t('access.holders')}</h2>
        <PeopleList people={holders} />
      </Card>
      <Card aria-label={t('access.give')}>
        <div className="flex flex-col gap-3 px-5 pt-5 lg:px-8">
          <h2 className="m-0 text-base font-bold">{t('access.give')}</h2>
          <SearchField
            label={t('access.search')}
            placeholder={t('access.searchPlaceholder')}
            value={search}
            onChange={setSearch}
          />
        </div>
        {searched.length < 2 ? (
          <p className="m-0 px-5 py-4 text-sm text-text-2 lg:px-8">{t('access.typeName')}</p>
        ) : !people.data ? (
          <SkeletonRows rows={2} />
        ) : people.data.length === 0 ? (
          <EmptyState variant="padded">{t('access.nobody')}</EmptyState>
        ) : (
          <PeopleList people={people.data} />
        )}
      </Card>
    </PageStack>
  );
}

function PeopleList({ people }: { people: readonly Holder[] }) {
  return (
    <ul className="m-0 list-none p-0 pt-2 pb-3">
      {people.map((person) => (
        <li key={person.id}>
          <PersonRow person={person} />
        </li>
      ))}
    </ul>
  );
}

function PersonRow({ person }: { person: Holder }) {
  const { t } = useTranslation('messages');
  const setAccess = useSetAccess();
  const toggle = (key: AccessKey, given: boolean) =>
    setAccess.mutate(
      { id: person.id, [key]: given },
      {
        onSuccess: () =>
          toast.success(
            t(given ? 'access.given' : 'access.taken', {
              name: person.name,
              key: t(`access.key.${key}`),
            }),
          ),
        onError: () => toast.error(t('saveError')),
      },
    );

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-1 px-5 py-2 shadow-[inset_0_1px_0_var(--hair)] lg:px-8">
      <span className="flex min-w-0 flex-[1_1_200px] items-center gap-2">
        <span className="text-[15px] font-semibold">{person.name}</span>
        {person.is_superuser && (
          <Chip tone="primary" small>
            {t('access.superuser')}
          </Chip>
        )}
      </span>
      <span className="flex flex-[1_1_360px] flex-wrap gap-x-6">
        {ACCESS_KEYS.map((key) => (
          <span key={key} className="min-w-[200px] flex-1">
            <Switch
              label={t(`access.key.${key}`)}
              {...(person.fixed[key] ? { description: t('access.fixed') } : {})}
              checked={person.keys[key]}
              disabled={person.fixed[key] || setAccess.isPending}
              onChange={(given) => toggle(key, given)}
            />
          </span>
        ))}
      </span>
    </div>
  );
}
