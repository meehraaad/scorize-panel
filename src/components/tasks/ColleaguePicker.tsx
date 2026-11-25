import { useDeferredValue, useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SearchField } from '@/components/ui/Filters';
import type { Colleague } from '@/lib/tasks/api';
import { matchesSearch } from '@/lib/text';

interface Group {
  key: string;
  title: string;
  people: Colleague[];
}

/**
 * The shown colleagues in groups: the suggested ones first (`suggestedTitle`), then everyone else
 * by team, teams in alphabetical order, and those with no team last (`othersTitle`). One untitled
 * group when the server sent no teams.
 */
function groupsOf(
  shown: readonly Colleague[],
  suggestedTitle: string | undefined,
  othersTitle: string,
): Group[] {
  if (shown.length === 0) return [];
  if (!shown.some((colleague) => colleague.team !== undefined))
    return [{ key: 'all', title: '', people: [...shown] }];
  const groups = new Map<string, Group>();
  const add = (key: string, title: string, colleague: Colleague) => {
    const group = groups.get(key) ?? { key, title, people: [] };
    group.people.push(colleague);
    groups.set(key, group);
  };
  for (const colleague of shown) {
    if (colleague.suggested) add('suggested', suggestedTitle ?? '', colleague);
    else add(`team:${colleague.team ?? ''}`, colleague.team || othersTitle, colleague);
  }
  const suggested = groups.get('suggested');
  const teams = [...groups.values()]
    .filter((group) => group !== suggested)
    .sort(
      (a, b) =>
        Number(a.key === 'team:') - Number(b.key === 'team:') || a.title.localeCompare(b.title),
    );
  return suggested ? [suggested, ...teams] : teams;
}

/**
 * Pick colleagues for a task: a search box over a scrolling list. The list arrives with the page
 * (`colleagues`, every active colleague), so typing filters it on the device: no request per key.
 * Matches name, role or team, word by word, folding Arabic/Persian letters, half-spaces and digits.
 * The people the server suggests come first, then everyone by team.
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
  suggestedTitle,
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
  /** The heading over the suggested people (the customer page: the people on their case). */
  suggestedTitle?: string;
  /** The id of a hint under the picker. */
  describedBy?: string | undefined;
}) {
  const { t } = useTranslation();
  const name = useId();
  const [query, setQuery] = useState('');
  const deferred = useDeferredValue(query);
  const groups = useMemo(
    () =>
      groupsOf(
        colleagues.filter(
          (colleague) =>
            (!multiple && picked.includes(colleague.id)) ||
            matchesSearch(deferred, colleague.name, colleague.role, colleague.team ?? ''),
        ),
        suggestedTitle,
        t('colleagues.others'),
      ),
    [colleagues, deferred, multiple, picked, suggestedTitle, t],
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
      <div
        role="group"
        aria-label={label}
        aria-describedby={describedBy}
        className="flex max-h-72 flex-col gap-1 overflow-y-auto overscroll-contain"
      >
        {groups.map((group) => (
          <section key={group.key} aria-label={group.title || undefined}>
            {group.title && (
              <h3
                className={`m-0 px-2.5 pt-3 pb-1 text-xs font-bold ${
                  group.key === 'suggested' ? 'text-primary-text' : 'text-text-2'
                }`}
              >
                {group.title}
              </h3>
            )}
            <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
              {group.people.map((colleague) => (
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
                      {/* In a team's group the team is the heading: only a suggested role is news. */}
                      {(group.key === 'suggested' || group.key === 'all') && colleague.role && (
                        <span className="truncate text-xs text-text-2">{colleague.role}</span>
                      )}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </section>
        ))}
        {groups.length === 0 && <p className="m-0 px-2.5 py-2 text-sm text-text-2">{noMatch}</p>}
      </div>
    </div>
  );
}
