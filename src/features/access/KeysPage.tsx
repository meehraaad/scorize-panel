import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Card } from '@/components/ui/Card';
import { TogglePill } from '@/components/ui/Choices';
import { SearchField } from '@/components/ui/Filters';
import { PageStack } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { useFormat } from '@/lib/i18n/useFormat';
import { useAccessPath, groupsQuery, keysQuery } from './api';

/**
 * Every key in the system, by area: what it opens, which groups give it, and how many people hold
 * it (a link to them). Django admin's own add/change/delete/view keys only when asked for.
 */
export default function KeysPage() {
  const { t } = useTranslation('access');
  const root = useAccessPath();
  const f = useFormat();
  const [admin, setAdmin] = useState(false);
  const [search, setSearch] = useState('');
  const { data } = useQuery(keysQuery(admin));
  const groups = useQuery(groupsQuery);
  const groupName = (id: number) => groups.data?.find((group) => group.id === id)?.name ?? '';
  const term = search.trim().toLowerCase();
  const shown = (data?.keys ?? []).filter(
    (key) =>
      !term ||
      key.label.toLowerCase().includes(term) ||
      key.about.toLowerCase().includes(term) ||
      key.id.toLowerCase().includes(term),
  );

  return (
    <PageStack>
      <PageHeader
        title={t('keys.title')}
        subtitle={
          data
            ? t('keys.subtitle', { count: data.superusers, n: f.number(data.superusers) })
            : undefined
        }
      />
      <div className="flex flex-wrap items-center gap-3">
        <SearchField
          label={t('keys.search')}
          placeholder={t('keys.searchPlaceholder')}
          value={search}
          onChange={setSearch}
        />
        <TogglePill label={t('keys.showAdmin')} checked={admin} onChange={setAdmin} />
      </div>
      {!data ? (
        <Card aria-busy>
          <SkeletonRows rows={6} />
        </Card>
      ) : shown.length === 0 ? (
        <p className="m-0 text-sm text-text-2">{t('keys.noMatch')}</p>
      ) : (
        data.areas.map((area) => {
          const rows = shown.filter((key) => key.area === area.id);
          if (rows.length === 0) return null;
          return (
            <Card key={area.id} aria-label={area.label}>
              <h2 className="m-0 px-5 pt-5 text-base font-bold lg:px-8">{area.label}</h2>
              <ul className="m-0 list-none p-0 pt-2 pb-2">
                {rows.map((key) => (
                  <li
                    key={key.id}
                    className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 shadow-[inset_0_1px_0_var(--hair)] lg:px-8"
                  >
                    <span className="flex min-w-0 flex-[1_1_320px] flex-col gap-0.5">
                      <span className="text-[15px] font-semibold">{key.label}</span>
                      {key.about && (
                        <span className="text-[13px] leading-6 text-text-2">{key.about}</span>
                      )}
                      <span className="text-[12px] text-text-3" dir="ltr">
                        {key.id}
                      </span>
                      {key.groups.length > 0 && (
                        <span className="text-[13px] text-text-2">
                          {t('keys.inGroups', {
                            groups: key.groups.map(groupName).filter(Boolean).join(t('separator')),
                          })}
                        </span>
                      )}
                    </span>
                    <Link
                      to={`${root}?key=${encodeURIComponent(key.id)}`}
                      className="inline-flex min-h-11 items-center text-sm font-medium text-primary-text"
                    >
                      {key.holders === 0
                        ? t('keys.nobody')
                        : t('keys.holders', { count: key.holders, n: f.number(key.holders) })}
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          );
        })
      )}
    </PageStack>
  );
}
