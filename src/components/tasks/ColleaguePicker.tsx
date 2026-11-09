import { useDeferredValue, useId, useMemo, useState } from 'react';
import { SearchField } from '@/components/ui/Filters';
import type { Colleague } from '@/lib/tasks/api';
import { matchesSearch } from '@/lib/text';

/**
 * Pick colleagues for a task: a search box over a scrolling list. The list arrives with the page
 * (`colleagues`), so typing filters it on the device: no request per key. Matches name or role,
 * word by word, folding Arabic/Persian letters, half-spaces and digits.
 * `multiple`: checkboxes (several colleagues); else radios, and the chosen one stays in the list.
 */
export function ColleaguePicker({
  colleagues,
  picked,
  onToggle,
  multiple = false,
  label,
  searchLabel,
  noMatch,
  describedBy,
}: {
  colleagues: readonly Colleague[];
  picked: readonly number[];
  onToggle: (id: number) => void;
  multiple?: boolean;
  /** The list's accessible name. */
  label: string;
  searchLabel: string;
  noMatch: string;
  /** The id of a hint under the picker. */
  describedBy?: string | undefined;
}) {
  const name = useId();
  const [query, setQuery] = useState('');
  const deferred = useDeferredValue(query);
  const shown = useMemo(
    () =>
      colleagues.filter(
        (colleague) =>
          (!multiple && picked.includes(colleague.id)) ||
          matchesSearch(deferred, colleague.name, colleague.role),
      ),
    [colleagues, deferred, multiple, picked],
  );
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <SearchField
        label={searchLabel}
        placeholder={searchLabel}
        value={query}
        onChange={setQuery}
        className="w-full"
      />
      <ul
        role="group"
        aria-label={label}
        aria-describedby={describedBy}
        className="m-0 flex max-h-64 list-none flex-col gap-0.5 overflow-y-auto p-0"
      >
        {shown.map((colleague) => (
          <li key={colleague.id}>
            <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl px-2.5 py-1.5 hover:bg-track has-checked:bg-tint has-focus-visible:outline-2 has-focus-visible:outline-focus">
              <input
                type={multiple ? 'checkbox' : 'radio'}
                name={multiple ? undefined : name}
                checked={picked.includes(colleague.id)}
                onChange={() => onToggle(colleague.id)}
                className="size-5 flex-none accent-primary"
              />
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-semibold">{colleague.name}</span>
                <span className="truncate text-xs text-text-2">{colleague.role}</span>
              </span>
            </label>
          </li>
        ))}
        {shown.length === 0 && <li className="px-2.5 py-2 text-sm text-text-2">{noMatch}</li>}
      </ul>
    </div>
  );
}
