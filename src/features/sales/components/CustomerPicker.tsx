import { useQuery } from '@tanstack/react-query';
import { useId, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { ON_SERVER } from '@/lib/applicant/onServer';
import { useFormat } from '@/lib/i18n/useFormat';
import { useDisplayName } from '@/lib/i18n/useDisplayName';
import { formatPhone } from '@/lib/site';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { firstLeadQuery, leadSearchQuery, leadsQuery, type LeadMatch } from '../api';
import { OwnerTag } from './OwnerTag';

/** Leads a follow-up can be set on (the server skips the rest). */
const OPEN = new Set(['new', 'contacted', 'consulted', 'offer']);
const SHOWN = 8;
/** A pause in typing this long sends the search. */
const SEARCH_DELAY_MS = 250;
const MIN_LETTERS = 2;

/**
 * Finding one of the seller's open leads by name or phone, as a combobox: the matches come once
 * typing pauses, best first, each with its stage and its follow-up; arrows move, Enter picks.
 */
export function CustomerPicker({
  value,
  onChange,
  error,
}: {
  value: LeadMatch | null;
  onChange: (lead: LeadMatch | null) => void;
  error?: string | undefined;
}) {
  const { t } = useTranslation('sales');
  const named = useDisplayName();
  const f = useFormat();
  const id = useId();
  const [search, setSearch] = useState('');
  const [active, setActive] = useState(0);
  const typed = search.trim();
  const settled = useDebouncedValue(typed, SEARCH_DELAY_MS);
  const ready = settled.replace(/\s/g, '').length >= MIN_LETTERS;
  const light = useQuery({ ...leadSearchQuery(settled), enabled: ON_SERVER.leadSearch && ready });
  // Before S56: the leads list's own search, its open rows.
  const list = useQuery({
    ...leadsQuery({ ...firstLeadQuery('all'), search: settled }),
    enabled: !ON_SERVER.leadSearch && ready,
  });
  const found = ON_SERVER.leadSearch ? light : list;
  const rows: LeadMatch[] = (
    ON_SERVER.leadSearch
      ? (light.data?.results ?? [])
      : (list.data?.results ?? [])
          .filter((row) => OPEN.has(row.stage))
          .map((row) => ({
            id: row.id,
            customer: row.customer,
            name: named(row.name),
            phone: row.phone,
            stage: row.stage,
            follow_up_at: row.follow_up_at,
            ...(row.seller === undefined ? {} : { seller: row.seller }),
          }))
  ).slice(0, SHOWN);
  const typing = typed.replace(/\s/g, '').length >= MIN_LETTERS;
  const searching = typing && (settled !== typed || found.isFetching);
  const open = typing && value === null;
  const listId = `${id}-list`;
  const optionId = (index: number) => `${id}-option-${String(index)}`;
  const current = Math.min(active, rows.length - 1);

  const onKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!open || rows.length === 0) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActive((index) => (Math.min(index, rows.length - 1) + step + rows.length) % rows.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const row = rows[current];
      if (row) onChange(row);
    }
  };

  if (value)
    return (
      <div className="flex flex-col gap-2">
        <span className="text-[15px] font-medium text-text">{t('followUpDialog.customer')}</span>
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-tint px-4 py-3">
          <Match row={value} />
          <button
            type="button"
            onClick={() => onChange(null)}
            className="min-h-11 flex-none rounded-full px-3 text-sm font-semibold text-primary-text hover:bg-surface"
          >
            {t('followUpDialog.otherCustomer')}
          </button>
        </div>
      </div>
    );

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-[15px] font-medium text-text">
        {t('followUpDialog.customer')}
      </label>
      <input
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && rows.length > 0 ? optionId(current) : undefined}
        aria-describedby={`${id}-message`}
        aria-invalid={error ? true : undefined}
        autoComplete="off"
        value={search}
        onChange={(event) => {
          setSearch(event.target.value);
          setActive(0);
        }}
        onKeyDown={onKey}
        className={`min-h-12 rounded-2xl bg-surface px-4 text-[15px] shadow-[inset_0_0_0_1px_var(--line-2)] outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--primary)] ${
          error ? 'shadow-[inset_0_0_0_1.5px_var(--danger)]' : ''
        }`}
      />
      <span id={`${id}-message`} className={`text-sm ${error ? 'text-danger' : 'text-text-2'}`}>
        {error ?? t('followUpDialog.customerHint')}
      </span>
      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label={t('followUpDialog.matches')}
          aria-busy={searching}
          className="m-0 flex list-none flex-col gap-1 rounded-2xl bg-surface p-1 shadow-[inset_0_0_0_1px_var(--line-2)]"
        >
          {rows.map((row, index) => (
            <li
              key={row.id}
              id={optionId(index)}
              role="option"
              aria-selected={index === current}
              onMouseEnter={() => setActive(index)}
              // The input keeps focus: a click picks without blurring it first.
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onChange(row)}
              className={`flex min-h-12 cursor-pointer items-center rounded-xl px-3 py-2 ${
                index === current ? 'bg-tint' : ''
              }`}
            >
              <Match row={row} />
            </li>
          ))}
          {searching && (
            <li role="presentation" className="px-3 py-2.5 text-sm text-text-2">
              {t('followUpDialog.searching')}
            </li>
          )}
          {!searching && rows.length === 0 && (
            <li role="presentation" className="px-3 py-2.5 text-sm text-text-2">
              {t('followUpDialog.noMatch')}
            </li>
          )}
        </ul>
      )}
    </div>
  );

  function Match({ row }: { row: LeadMatch }) {
    return (
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="flex flex-wrap items-center gap-x-2">
          <span className="text-[15px] font-semibold">{named(row.name)}</span>
          <OwnerTag seller={row.seller} />
        </span>
        <span className="text-xs text-text-2">
          {[
            row.phone && <bdi key="phone">{formatPhone(row.phone)}</bdi>,
            t(`stage.${row.stage}`),
            row.follow_up_at
              ? t('followUpDialog.hasFollowUp', { when: f.dateTime(row.follow_up_at) })
              : t('followUpDialog.noFollowUp'),
          ]
            .filter(Boolean)
            .flatMap((part, index) => (index ? [' · ', part] : [part]))}
        </span>
      </span>
    );
  }
}
