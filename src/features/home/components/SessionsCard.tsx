import { useSuspenseInfiniteQuery, useSuspenseQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { BookingDialog } from '@/components/applicant/booking/BookingDialog';
import { preloadBooking } from '@/components/applicant/booking/preload';
import { Button } from '@/components/ui/Button';
import { buttonClass } from '@/components/ui/buttonStyles';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { sessionHref } from '@/lib/applicant/consultations';
import {
  consultationsQuery,
  sessionSummariesQuery,
  splitSessions,
} from '@/lib/applicant/consultations';
import { ON_SERVER } from '@/lib/applicant/onServer';
import { useFormat } from '@/lib/i18n/useFormat';
import { SITE } from '@/lib/site';

/** Entries shown at first, and how many more each "show more" adds. */
const FIRST = 4;
const MORE = 6;

interface Entry {
  key: string;
  title: string;
  meta: string;
  upcoming: boolean;
  /** What the consultant wrote after it, or the session's topic. */
  note: string | null;
  /** The booking, for its details and invoice; a call has none. */
  session: number | null;
}

/**
 * Every session on the home, once there is more than one: booked consultations (upcoming first,
 * soonest first) and past ones with calls (latest first), each opening to what the consultant
 * wrote. The latest past one starts open. Took the place of the consultations page.
 * Design: "مشاوره در صفحه اصلی پنل" canvas, several sessions.
 */
export function SessionsCard() {
  const { t } = useTranslation('home');
  const f = useFormat();
  const { data: sessions } = useSuspenseQuery(consultationsQuery);
  const {
    data: summaries,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useSuspenseInfiniteQuery(sessionSummariesQuery());
  const [shown, setShown] = useState(FIRST);
  const [booking, setBooking] = useState(false);

  const notes = summaries.pages.flatMap((page) => page.results);
  const { upcoming, past } = splitSessions(sessions.results);
  const noteOf = (id: number) => notes.find((row) => row.reservation === id)?.customer_summary;
  const booked = (upcomingOne: boolean) => (session: (typeof sessions.results)[number]) => ({
    key: `session-${String(session.id)}`,
    at: session.starts_at,
    title: session.title,
    meta: [
      f.weekday(session.starts_at),
      t('sessions.time', { time: f.time(session.starts_at) }),
      t(`sessions.mode.${session.mode}`),
      session.consultant,
    ]
      .filter(Boolean)
      .join(' · '),
    upcoming: upcomingOne,
    note: noteOf(session.id) ?? session.summary,
    session: session.id,
  });
  const calls = notes
    .filter((row) => row.reservation === null)
    .map((row) => ({
      key: `note-${String(row.id)}`,
      at: row.at,
      title: row.kind,
      meta: [f.weekday(row.at), ...row.authors].join(' · '),
      upcoming: false,
      note: row.customer_summary,
      session: null,
    }));
  const held = [...past.map(booked(false)), ...calls].sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
  );
  const entries: Entry[] = [...upcoming.map(booked(true)), ...held];
  if (entries.length < 2) return null;
  const opened = entries.find((entry) => !entry.upcoming)?.key;
  const hidden = entries.length - shown;

  const more = () => {
    setShown(shown + MORE);
    if (shown + MORE > entries.length && hasNextPage) void fetchNextPage();
  };

  return (
    <Card aria-labelledby="home-sessions" className="flex flex-col px-5 pt-5 pb-2 lg:px-8 lg:pt-7">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2.5">
        <div className="flex items-baseline gap-2.5">
          <h2 id="home-sessions" className="m-0 text-lg font-bold lg:text-[19px]">
            {t('sessions.title')}
          </h2>
          <span className="text-[13px] text-text-2">
            {t('sessions.count', { n: f.number(entries.length) })}
          </span>
        </div>
        {ON_SERVER.bookingCalendar ? (
          <button
            type="button"
            aria-haspopup="dialog"
            onPointerEnter={preloadBooking}
            onFocus={preloadBooking}
            onClick={() => setBooking(true)}
            className={buttonClass('outline')}
          >
            {t('sessions.book')}
          </button>
        ) : (
          <a href={SITE.consultation} className={buttonClass('outline')}>
            {t('sessions.book')}
          </a>
        )}
      </div>

      <ol className="m-0 list-none p-0">
        {entries.slice(0, shown).map((entry, index) => (
          <li key={entry.key} className="flex gap-3 lg:gap-4.5">
            <span aria-hidden="true" className="flex w-3.5 flex-none flex-col items-center">
              <span className={`h-6 w-0.5 ${index ? 'bg-line-2' : ''}`} />
              <span
                className={`flex-none rounded-full ${
                  entry.upcoming ? 'size-3 bg-luxe-gold' : 'size-3 bg-primary'
                }`}
              />
              <span
                className={`w-0.5 flex-1 ${index < Math.min(shown, entries.length) - 1 ? 'bg-line-2' : ''}`}
              />
            </span>
            <details
              open={entry.key === opened}
              className={`group min-w-0 flex-1 py-2.5 ${index ? 'shadow-[inset_0_1px_0_var(--hair)]' : ''}`}
            >
              <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 [&::-webkit-details-marker]:hidden">
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-[15px] font-bold">{entry.title}</span>
                    <span
                      className={`rounded-full px-2.5 text-xs font-semibold ${
                        entry.upcoming ? 'bg-luxe-gold' : 'bg-canvas text-text-2'
                      }`}
                    >
                      {t(entry.upcoming ? 'sessions.upcoming' : 'sessions.held')}
                    </span>
                  </span>
                  <span className="text-[13px] text-text-2">{entry.meta}</span>
                </span>
                <Icon
                  name="chevronDown"
                  size={18}
                  className="flex-none text-text-2 transition-transform group-open:rotate-180"
                />
              </summary>
              <div className="flex flex-col gap-1.5 pt-1.5">
                {entry.note && (
                  <>
                    <span className="text-xs font-bold text-primary-text">
                      {t(entry.upcoming ? 'sessions.topic' : 'sessions.note')}
                    </span>
                    <p className="m-0 text-sm leading-8 break-words whitespace-pre-wrap">
                      {entry.note}
                    </p>
                  </>
                )}
                {entry.session !== null && (
                  <Link
                    to={sessionHref(entry.session)}
                    className="inline-flex min-h-11 items-center self-start text-[13px] font-bold text-primary-text"
                  >
                    {t('sessions.details')}
                  </Link>
                )}
              </div>
            </details>
          </li>
        ))}
      </ol>
      {(hidden > 0 || hasNextPage) && (
        <Button variant="outline" disabled={isFetchingNextPage} onClick={more} className="mb-3">
          {t('sessions.more')}
        </Button>
      )}
      {ON_SERVER.bookingCalendar && (
        <BookingDialog open={booking} onClose={() => setBooking(false)} />
      )}
    </Card>
  );
}
