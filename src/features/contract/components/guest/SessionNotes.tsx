import { useSuspenseInfiniteQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SideSection } from '@/components/ui/SectionCard';
import { sessionSummariesQuery } from '@/lib/applicant/consultations';
import { useFormat } from '@/lib/i18n/useFormat';

/** Notes shown at first, and how many more each "show more" adds. */
const FIRST = 2;
const MORE = 5;

/**
 * What the consultant wrote after each session (the shared session advice: date, who, the note),
 * as a timeline, newest first and set larger: the reasons behind the contract offer. The last two,
 * then more on request (the next page loads when the loaded ones run out). None: not shown.
 * Design: canvas "Scorize New User Dashboard v2", ContractGuestSession.
 */
export function SessionNotes() {
  const { t } = useTranslation('contract');
  const f = useFormat();
  const { data, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useSuspenseInfiniteQuery(sessionSummariesQuery());
  const [shown, setShown] = useState(FIRST);
  const notes = data.pages.flatMap((page) => page.results);
  if (notes.length === 0) return null;
  const hidden = notes.length - shown;

  const more = () => {
    setShown(shown + MORE);
    if (shown + MORE > notes.length && hasNextPage) void fetchNextPage();
  };

  return (
    <SideSection
      id="contract-notes"
      title={t('guest.notes.title')}
      subtitle={t('guest.notes.subtitle')}
    >
      <ol className="m-0 list-none border-s-2 border-[var(--line-2)] p-0">
        {notes.slice(0, shown).map((note, index) => (
          <li key={note.id} className="relative ps-7 pb-7 last:pb-1">
            <span
              aria-hidden="true"
              className={`absolute -start-[7px] top-2 size-3 rounded-full shadow-[0_0_0_4px_var(--canvas)] ${
                index === 0 ? 'bg-primary' : 'bg-line-3'
              }`}
            />
            <span className="block text-[13px] text-text-2">
              <time dateTime={note.at} className="font-bold text-text">
                {f.date(note.at)}
              </time>
              {note.authors.length > 0 && t('guest.notes.with', { names: f.list(note.authors) })}
            </span>
            <p
              className={`m-0 mt-1.5 max-w-[62ch] leading-8 break-words whitespace-pre-wrap ${
                index === 0 ? 'text-lg font-semibold' : 'text-base'
              }`}
            >
              {note.customer_summary}
            </p>
          </li>
        ))}
      </ol>
      {(hidden > 0 || hasNextPage) && (
        <button
          type="button"
          disabled={isFetchingNextPage}
          onClick={more}
          className="ms-7 inline-flex min-h-11 items-center text-sm font-bold text-primary-text disabled:opacity-50"
        >
          {hidden > 0 ? t('guest.notes.more', { n: f.number(hidden) }) : t('guest.notes.older')}
        </button>
      )}
    </SideSection>
  );
}
