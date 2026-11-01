import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { SearchField } from '@/components/ui/Filters';
import { IconButton } from '@/components/ui/IconButton';
import { InlineConfirm } from '@/components/ui/InlineConfirm';
import { Pager } from '@/components/ui/Pager';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { pagesOf, useClampPage } from '@/lib/api/page';
import { useFormat } from '@/lib/i18n/useFormat';
import { toast } from '@/lib/toast';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { suppressedQuery, useUnsuppress, type SuppressedAddress } from '../api';

/** The addresses that bounced for good: no bot writes to them again until a manager removes one. */
export function SuppressedList() {
  const { t } = useTranslation('mail');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const { data, isPlaceholderData } = useQuery(
    suppressedQuery(useDebouncedValue(search.trim()), page),
  );
  useClampPage(data, page, setPage);

  return (
    <Card aria-label={t('view.suppressed')} aria-busy={!data || isPlaceholderData}>
      <div className="flex flex-col gap-3 px-5 pt-5 lg:px-8">
        <p className="m-0 text-sm leading-7 text-text-2">{t('suppressed.intro')}</p>
        <SearchField
          label={t('suppressed.search')}
          placeholder={t('suppressed.search')}
          value={search}
          onChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
        />
      </div>
      {!data ? (
        <SkeletonRows rows={5} />
      ) : data.results.length === 0 ? (
        <EmptyState variant="padded">{t('suppressed.empty')}</EmptyState>
      ) : (
        <ul className="m-0 list-none p-0 pt-3">
          {data.results.map((row) => (
            <SuppressedRow key={row.id} row={row} />
          ))}
        </ul>
      )}
      {data && data.count > 0 && (
        <Pager page={page} pages={pagesOf(data)} pending={isPlaceholderData} onPage={setPage} />
      )}
    </Card>
  );
}

function SuppressedRow({ row }: { row: SuppressedAddress }) {
  const { t } = useTranslation('mail');
  const f = useFormat();
  const remove = useUnsuppress();
  const [confirming, setConfirming] = useState(false);

  return (
    <li className="flex flex-col gap-2 px-5 py-3 shadow-[inset_0_1px_0_var(--hair)] lg:px-8">
      <div className="flex items-center gap-3">
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-[15px] font-semibold">
            <bdi>{row.address}</bdi>
          </span>
          <span className="text-[13px] text-text-2">
            {f.date(row.created_at)}
            {row.applicant && ` · ${t('suppressed.from', { name: row.applicant.name })}`}
          </span>
          {row.reason && (
            <span className="truncate text-[13px] text-text-2">
              <bdi>{row.reason}</bdi>
            </span>
          )}
        </span>
        {!confirming && (
          <IconButton
            icon="trash"
            tone="danger"
            aria-label={t('suppressed.remove', { address: row.address })}
            onClick={() => setConfirming(true)}
          />
        )}
      </div>
      {confirming && (
        <InlineConfirm
          message={t('suppressed.removeConfirm', { address: row.address })}
          confirmLabel={t('suppressed.removeButton')}
          cancelLabel={t('cancel')}
          pending={remove.isPending}
          onCancel={() => setConfirming(false)}
          onConfirm={() =>
            remove.mutate(row.id, {
              onSuccess: () => toast.success(t('suppressed.removed', { address: row.address })),
              onError: () => toast.error(t('saveError')),
            })
          }
        />
      )}
    </li>
  );
}
