import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { SearchField } from '@/components/ui/Filters';
import { PageColumns } from '@/components/ui/PageColumns';
import { Pager } from '@/components/ui/Pager';
import { SectionCard } from '@/components/ui/SectionCard';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { pagesOf } from '@/lib/api/page';
import { useFormat } from '@/lib/i18n/useFormat';
import { toast } from '@/lib/toast';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { searchWorkspaceQuery, useChangeSearchWorkspace } from './serviceToolsApi';

export function CustomerSearchTool({
  address,
}: {
  address: { customer: number; service: number };
}) {
  const { t } = useTranslation('executive');
  const f = useFormat();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const q = useDebouncedValue(search.trim());
  const { data, error, isPlaceholderData } = useQuery(searchWorkspaceQuery(address, q, page));
  const change = useChangeSearchWorkspace(address);
  if (error && !data) throw error;
  const apply = (program: number | null) =>
    change.mutate(program, {
      onSuccess: () =>
        toast.success(
          t(program === null ? 'workspace.search.reviewSent' : 'workspace.search.added'),
        ),
      onError: () => toast.error(t('workspace.saveError')),
    });
  return (
    <PageColumns
      asideLabel={t('workspace.search.catalog')}
      aside={
        <SectionCard id="program-catalog" title={t('workspace.search.catalog')} variant="panel">
          <SearchField
            label={t('workspace.search.find')}
            placeholder={t('workspace.search.find')}
            value={search}
            onChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            className="w-full"
            maxLength={120}
          />
          {q.length < 2 ? null : !data || isPlaceholderData ? (
            <SkeletonRows rows={3} />
          ) : (
            <>
              {data.catalog.results.length > 0 ? (
                <ul className="m-0 list-none divide-y divide-hair p-0">
                  {data.catalog.results.map((program) => (
                    <li key={program.id} className="flex flex-col items-start gap-1 py-2">
                      <strong>{program.name}</strong>
                      <span className="text-label text-text-2">{program.university}</span>
                      {data.can_edit && (
                        <Button
                          variant="quiet"
                          disabled={change.isPending}
                          onClick={() => apply(program.id)}
                        >
                          {t('workspace.search.add')}
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState>{t('workspace.search.noPrograms')}</EmptyState>
              )}
              <Pager inset page={page} pages={pagesOf(data.catalog)} onPage={setPage} />
            </>
          )}
        </SectionCard>
      }
      main={
        <SectionCard
          id="program-shortlist"
          title={t('workspace.search.shortlist')}
          variant="panel"
          end={
            data?.can_edit &&
            data.reviewer &&
            data.shortlist.length > 0 && (
              <Button disabled={change.isPending} variant="outline" onClick={() => apply(null)}>
                {t('workspace.search.review', { name: data.reviewer })}
              </Button>
            )
          }
        >
          {!data ? (
            <SkeletonRows rows={4} />
          ) : data.shortlist.length === 0 ? (
            <EmptyState>{t('workspace.search.empty')}</EmptyState>
          ) : (
            <ul className="m-0 list-none divide-y divide-hair p-0">
              {data.shortlist.map((program) => (
                <li
                  key={program.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <div>
                    <strong>{program.name || program.university}</strong>
                    <div className="text-small text-text-2">
                      {[program.university, program.country, program.degree]
                        .filter(Boolean)
                        .join(' · ')}
                    </div>
                  </div>
                  {program.deadline && (
                    <time dateTime={program.deadline}>{f.date(program.deadline)}</time>
                  )}
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      }
    />
  );
}
