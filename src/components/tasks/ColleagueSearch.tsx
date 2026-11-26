import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/ui/Icon';
import { SuggestField } from '@/components/ui/SuggestField';
import type { Colleague, TasksPanel } from '@/lib/tasks/api';
import { COLLEAGUE_SEARCH_MIN, colleagueSearchQuery } from '@/lib/tasks/colleagues';
import { useDebouncedValue } from '@/lib/useDebouncedValue';

/**
 * Pick colleagues by name (meeting0): nothing is loaded before typing. From two letters, after a
 * pause, the server sends up to eight (`panel`: only its people, whom its tasks may go to; without
 * it anyone active, a meeting's guest). The customer's own people (`suggested`) show on focus, before
 * any typing. The picked ones are chips under the field; `multiple`: several, else one replaces the
 * other. An answer for an older search never shows (only the one for what is typed now).
 */
export function ColleagueSearch({
  label,
  picked,
  onChange,
  panel,
  suggested = [],
  multiple = false,
  hint,
  error,
}: {
  label: string;
  picked: readonly Colleague[];
  onChange: (picked: Colleague[]) => void;
  panel?: TasksPanel | undefined;
  suggested?: readonly Colleague[] | undefined;
  multiple?: boolean;
  hint?: string | undefined;
  error?: string | undefined;
}) {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const typed = text.trim();
  const settled = useDebouncedValue(typed);
  const search = useQuery(colleagueSearchQuery(settled, panel));
  const current = settled === typed;
  const found = typed.length >= COLLEAGUE_SEARCH_MIN && current ? (search.data ?? []) : [];
  const pickedIds = new Set(picked.map((colleague) => colleague.id));
  const offered = (typed ? found : suggested).filter((colleague) => !pickedIds.has(colleague.id));
  const byId = new Map(offered.map((colleague) => [String(colleague.id), colleague]));

  const pick = (id: string) => {
    const colleague = byId.get(id);
    if (!colleague) return;
    onChange(multiple ? [...picked, colleague] : [colleague]);
    setText('');
  };

  const status =
    typed.length > 0 && typed.length < COLLEAGUE_SEARCH_MIN
      ? t('colleagues.typeMore')
      : typed && (!current || search.isFetching)
        ? t('colleagues.searching')
        : typed && search.isError
          ? t('colleagues.failed')
          : typed && found.length === 0
            ? t(panel && panel !== 'staff' ? 'colleagues.noMatchPanel' : 'colleagues.noMatch')
            : undefined;

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <SuggestField
        label={label}
        placeholder={t('colleagues.placeholder')}
        value={text}
        onValue={setText}
        onPick={pick}
        suggestions={offered.map((colleague) => String(colleague.id))}
        listLabel={t('colleagues.found')}
        describe={(id) => {
          const colleague = byId.get(id);
          return colleague ? (
            <span className="flex w-full items-center gap-3 py-1">
              <span
                aria-hidden="true"
                className="flex size-9 flex-none items-center justify-center rounded-xl bg-neutral-tint font-bold"
              >
                {colleague.name.charAt(0)}
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="truncate font-semibold">{colleague.name}</span>
                {colleague.role && (
                  <span className="truncate text-small text-text-2">{colleague.role}</span>
                )}
              </span>
            </span>
          ) : (
            id
          );
        }}
        // While typing, how the search goes says more than an earlier "pick someone".
        hint={status ?? hint}
        error={status ? undefined : error}
      />
      {picked.length > 0 && (
        <ul className="m-0 flex list-none flex-wrap gap-2 p-0" aria-label={t('colleagues.picked')}>
          {picked.map((colleague) => (
            <li key={colleague.id}>
              <span className="inline-flex min-h-11 items-center gap-2 rounded-full bg-tint ps-1.5 pe-1 text-sm font-semibold text-primary-text">
                <span
                  aria-hidden="true"
                  className="flex size-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-on-primary"
                >
                  {colleague.name.charAt(0)}
                </span>
                <span className="max-w-40 truncate">{colleague.name}</span>
                <button
                  type="button"
                  onClick={() => onChange(picked.filter((one) => one.id !== colleague.id))}
                  aria-label={t('colleagues.remove', { name: colleague.name })}
                  className="flex size-9 cursor-pointer items-center justify-center rounded-full hover:bg-surface focus-visible:outline-2 focus-visible:outline-focus"
                >
                  <Icon name="close" size={14} />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
