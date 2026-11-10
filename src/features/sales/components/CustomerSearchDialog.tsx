import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Button } from '@/components/ui/Button';
import { buttonClass } from '@/components/ui/buttonStyles';
import { Dialog } from '@/components/ui/Dialog';
import { SearchField } from '@/components/ui/Filters';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { formatPhone } from '@/lib/site';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { customerSearchQuery } from '../api';
import { customerPath } from '../paths';

/** Fewer letters than this match too much (the server answers nothing). */
const MIN_LETTERS = 2;
const SEARCH_DELAY_MS = 300;

/**
 * Finding anyone with an account by name, email or phone, the seller's or not, like the old CRM's
 * search (S63). Every one opens their page, the seller's or not; another seller's also names them.
 * Nobody found: the typed person can be added as a new lead.
 */
export function CustomerSearchDialog({
  open,
  onClose,
  onAddNew,
}: {
  open: boolean;
  onClose: () => void;
  onAddNew: () => void;
}) {
  const { t } = useTranslation('sales');
  const [search, setSearch] = useState('');
  const typed = search.trim();
  const settled = useDebouncedValue(typed, SEARCH_DELAY_MS);
  const ready = settled.replace(/\s/g, '').length >= MIN_LETTERS;
  const found = useQuery({ ...customerSearchQuery(settled), enabled: open && ready });
  const rows = ready ? (found.data?.results ?? []) : [];
  const searching = ready && (settled !== typed || found.isFetching);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('leads.find.title')}
      subtitle={t('leads.find.subtitle')}
      closeLabel={t('close')}
    >
      <div className="flex flex-col gap-4">
        <SearchField
          label={t('leads.find.label')}
          placeholder={t('leads.find.placeholder')}
          value={search}
          onChange={setSearch}
          className="w-full"
        />
        {!ready && <p className="m-0 text-sm text-text-2">{t('leads.find.hint')}</p>}
        {ready && found.isPending && <SkeletonRows rows={3} />}
        {ready && found.isError && <p className="m-0 text-sm text-danger">{t('error')}</p>}
        {ready && found.isSuccess && rows.length === 0 && !searching && (
          <div className="flex flex-col items-start gap-3 rounded-2xl bg-tint p-4">
            <p className="m-0 text-[15px]">{t('leads.find.none')}</p>
            <Button variant="outline" onClick={onAddNew}>
              {t('leads.find.addNew')}
            </Button>
          </div>
        )}
        {rows.length > 0 && (
          <ul
            aria-label={t('leads.find.results')}
            aria-busy={searching}
            className="m-0 flex list-none flex-col divide-y divide-hair p-0"
          >
            {rows.map((row) => (
              <li key={row.customer} className="flex flex-wrap items-center gap-3 py-3">
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-[15px] font-semibold [overflow-wrap:anywhere]">
                    {row.name || t('leads.find.noName')}
                  </span>
                  <span className="text-xs [overflow-wrap:anywhere] text-text-2">
                    {[
                      row.phone && <bdi key="phone">{formatPhone(row.phone)}</bdi>,
                      row.email && <bdi key="email">{row.email}</bdi>,
                      row.stage && t(`stage.${row.stage}`),
                    ]
                      .filter(Boolean)
                      .flatMap((part, index) => (index ? [' · ', part] : [part]))}
                  </span>
                  {row.access === 'other' && (
                    <span className="text-xs font-medium [overflow-wrap:anywhere] text-text-2">
                      {t('leads.find.other', { seller: row.seller ?? '' })}
                    </span>
                  )}
                </span>
                <Link
                  to={customerPath(row.customer)}
                  onClick={onClose}
                  className={buttonClass('outline', 'inline-flex flex-none items-center')}
                >
                  {t('leads.find.open')}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Dialog>
  );
}
