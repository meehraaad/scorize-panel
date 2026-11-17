import { useQuery } from '@tanstack/react-query';
import { useId, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { ON_SERVER } from '@/lib/applicant/onServer';
import { useFormat } from '@/lib/i18n/useFormat';
import { useDisplayName } from '@/lib/i18n/useDisplayName';
import { formatPhone } from '@/lib/site';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import {
  customerSearchQuery,
  firstLeadQuery,
  leadSearchQuery,
  leadsQuery,
  type CustomerMatch,
  type LeadMatch,
} from '../api';
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
 *
 * With `onNoLead`, a search that finds no open lead goes on to anyone with an account: a customer
 * nobody has an open lead on can be picked too (`noLead`), and one with another seller's open lead
 * is shown with their name and can't be (a follow-up would land on that seller's lead).
 */
export function CustomerPicker({
  value,
  onChange,
  noLead = null,
  onNoLead,
  error,
}: {
  value: LeadMatch | null;
  onChange: (lead: LeadMatch | null) => void;
  /** The customer picked without an open lead (with `onNoLead`). */
  noLead?: CustomerMatch | null;
  onNoLead?: ((customer: CustomerMatch | null) => void) | undefined;
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
  const noOpenLead = ready && found.isSuccess && !found.isFetching && rows.length === 0;
  // No open lead found: the customers with an account, the ones a follow-up task can be about.
  const anyone = useQuery({
    ...customerSearchQuery(settled),
    enabled: onNoLead !== undefined && ON_SERVER.customerSearch && noOpenLead,
  });
  const others: CustomerMatch[] =
    onNoLead !== undefined && rows.length === 0 ? (anyone.data?.results ?? []).slice(0, SHOWN) : [];
  const searching =
    typing && (settled !== typed || found.isFetching || (noOpenLead && anyone.isFetching));
  const open = typing && value === null && noLead === null;
  const choices: (LeadMatch | CustomerMatch)[] =
    rows.length > 0 ? rows : others.filter((row) => row.access !== 'other');
  const count = choices.length;
  const listId = `${id}-list`;
  const optionId = (index: number) => `${id}-option-${String(index)}`;
  const current = Math.min(active, choices.length - 1);

  const pick = (row: LeadMatch | CustomerMatch | undefined) => {
    if (!row) return;
    if ('id' in row) onChange(row);
    else onNoLead?.(row);
  };

  const onKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!open || count === 0) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActive((index) => (Math.min(index, count - 1) + step + count) % count);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      pick(choices[current]);
    }
  };

  if (value || noLead)
    return (
      <div className="flex flex-col gap-2">
        <span className="text-[15px] font-medium text-text">{t('followUpDialog.customer')}</span>
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-tint px-4 py-3">
          {value ? <Match row={value} /> : noLead && <NoLeadMatch row={noLead} />}
          <button
            type="button"
            onClick={() => {
              onChange(null);
              onNoLead?.(null);
            }}
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
        aria-activedescendant={open && count > 0 ? optionId(current) : undefined}
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
          {!searching && others.length > 0 && (
            <li role="presentation" className="px-3 py-2 text-xs text-text-2">
              {t('followUpDialog.noOpenLeadFound')}
            </li>
          )}
          {others.map((row) => {
            const index = choices.indexOf(row);
            const taken = row.access === 'other';
            return (
              <li
                key={row.customer}
                id={taken ? undefined : optionId(index)}
                role="option"
                aria-selected={!taken && index === current}
                aria-disabled={taken || undefined}
                onMouseEnter={() => !taken && setActive(index)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => !taken && pick(row)}
                className={`flex min-h-12 items-center rounded-xl px-3 py-2 ${
                  taken ? 'opacity-70' : 'cursor-pointer'
                } ${!taken && index === current ? 'bg-tint' : ''}`}
              >
                <NoLeadMatch row={row} />
              </li>
            );
          })}
          {searching && (
            <li role="presentation" className="px-3 py-2.5 text-sm text-text-2">
              {t('followUpDialog.searching')}
            </li>
          )}
          {!searching && rows.length === 0 && others.length === 0 && (
            <li role="presentation" className="px-3 py-2.5 text-sm text-text-2">
              {t('followUpDialog.noMatch')}
            </li>
          )}
        </ul>
      )}
    </div>
  );

  function NoLeadMatch({ row }: { row: CustomerMatch }) {
    return (
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[15px] font-semibold">{named(row.name)}</span>
        <span className="text-xs text-text-2">
          {[
            row.phone && <bdi key="phone">{formatPhone(row.phone)}</bdi>,
            row.access === 'other'
              ? t('followUpDialog.belongsTo', { seller: row.seller ?? '' })
              : t('followUpDialog.noLead'),
          ]
            .filter(Boolean)
            .flatMap((part, index) => (index ? [' · ', part] : [part]))}
        </span>
      </span>
    );
  }

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
