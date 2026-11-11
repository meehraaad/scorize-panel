import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import { PageStack } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { useFormat } from '@/lib/i18n/useFormat';
import { ACCESS_PATH, groupsQuery, keysQuery, type AccessGroup } from './api';
import { GroupDialog } from './components/GroupDialog';

/** The groups of keys: each one's keys and people; make a new one ("ناظر تماس": two keys). */
export default function GroupsPage() {
  const { t } = useTranslation('access');
  const f = useFormat();
  const { data } = useQuery(groupsQuery);
  const keys = useQuery(keysQuery());
  const [open, setOpen] = useState<AccessGroup | 'new' | null>(null);
  const label = (id: string) => keys.data?.keys.find((key) => key.id === id)?.label ?? id;

  return (
    <PageStack>
      <PageHeader
        title={t('groups.title')}
        subtitle={t('groups.pageSubtitle')}
        actions={
          <Button onClick={() => setOpen('new')}>
            <Icon name="plus" size={18} />
            {t('groups.new')}
          </Button>
        }
      />
      <Card aria-label={t('groups.list')} aria-busy={!data}>
        {!data ? (
          <SkeletonRows rows={4} />
        ) : data.length === 0 ? (
          <EmptyState variant="padded">{t('groups.empty')}</EmptyState>
        ) : (
          <ul className="m-0 list-none p-0">
            {data.map((group, index) => (
              <li
                key={group.id}
                className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5 lg:px-8 ${
                  index ? 'shadow-[inset_0_1px_0_var(--hair)]' : ''
                }`}
              >
                <button
                  type="button"
                  onClick={() => setOpen(group)}
                  aria-label={t('groups.open', { name: group.name })}
                  className="flex min-w-0 flex-[1_1_320px] flex-col gap-1 rounded-2xl text-start hover:text-primary-text"
                >
                  <span className="flex items-center gap-2 text-[15px] font-semibold">
                    {group.name}
                    {group.system && (
                      <Chip tone="neutral" small>
                        {t('groups.systemChip')}
                      </Chip>
                    )}
                  </span>
                  <span className="line-clamp-2 text-[13px] leading-6 text-text-2">
                    {group.keys.length === 0
                      ? t('groups.noKeys')
                      : group.keys.map(label).join(t('separator'))}
                  </span>
                </button>
                <Link
                  to={`${ACCESS_PATH}?group=${String(group.id)}`}
                  className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-primary-text"
                >
                  {t('groups.membersCount', { count: group.members, n: f.number(group.members) })}
                  <Icon name="chevronEnd" size={16} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {open && <GroupDialog group={open === 'new' ? null : open} onClose={() => setOpen(null)} />}
    </PageStack>
  );
}
