import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { buttonClass } from '@/components/ui/buttonStyles';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pager } from '@/components/ui/Pager';
import { SectionCard } from '@/components/ui/SectionCard';
import { ON_SERVER } from '@/lib/applicant/onServer';
import { useFormat } from '@/lib/i18n/useFormat';
import { SITE } from '@/lib/site';
import { safeHref } from '@/lib/url';
import type { ServicesData } from '../api';

const ROW = 'flex items-center gap-3 px-5 py-3.5 shadow-[inset_0_1px_0_var(--hair)] lg:px-7';

/** Rows per page in each list. The server sends them all (one user's purchases, bookings, events). */
export const SERVICES_PAGE_SIZE = 5;

/** A page of `all`, and the pager under the list (only when there is more than one page). */
function usePaged<T>(all: readonly T[]) {
  const { t } = useTranslation('services');
  const f = useFormat();
  const [chosen, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(all.length / SERVICES_PAGE_SIZE));
  const page = Math.min(chosen, pages);
  const from = (page - 1) * SERVICES_PAGE_SIZE;
  const rows = all.slice(from, from + SERVICES_PAGE_SIZE);
  const pager = pages > 1 && (
    <Pager
      page={page}
      pages={pages}
      onPage={setPage}
      status={t('pager', {
        from: f.number(from + 1),
        to: f.number(from + rows.length),
        total: f.number(all.length),
      })}
    />
  );
  return { rows, pager };
}

/** Courses and recordings the applicant bought, and the current offer. */
export function PackagesCard({ data }: { data: ServicesData }) {
  const { t } = useTranslation('services');
  const f = useFormat();
  const { rows, pager } = usePaged(data.packages);
  return (
    <SectionCard id="packages" title={t('packages.title')} size="md" className="scroll-mt-28">
      {data.packages.length === 0 ? (
        <EmptyState title={t('packages.emptyTitle')} icon="play">
          {t('packages.empty')}
        </EmptyState>
      ) : (
        <ul className="m-0 list-none p-0">
          {rows.map((item) => (
            <li key={item.id}>
              {ON_SERVER.packages ? (
                <Link
                  to={`/services/packages/${String(item.id)}`}
                  className={`${ROW} text-text hover:bg-canvas`}
                >
                  <span
                    aria-hidden="true"
                    className="flex h-12 w-16 flex-none items-center justify-center rounded-xl bg-hero text-[11px] font-bold tracking-wider text-on-hero"
                  >
                    {item.tag}
                  </span>
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-[15px] font-semibold">{item.name}</span>
                    <span className="text-[13px] text-text-2">{item.meta}</span>
                  </span>
                </Link>
              ) : (
                <div className={`${ROW} text-text`}>
                  <span
                    aria-hidden="true"
                    className="flex h-12 w-16 flex-none items-center justify-center rounded-xl bg-hero text-[11px] font-bold tracking-wider text-on-hero"
                  >
                    {item.tag}
                  </span>
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-[15px] font-semibold">{item.name}</span>
                    <span className="text-[13px] text-text-2">{item.meta}</span>
                  </span>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {pager}
      {data.offer && (
        <div className="m-4 mt-2 flex flex-wrap items-center justify-between gap-3 rounded-[18px] bg-tint px-4 py-3.5 lg:mx-6 lg:mb-6">
          <span className="flex flex-col gap-0.5">
            <span className="text-xs font-semibold text-primary-text">{data.offer.label}</span>
            <span className="text-[15px] font-semibold">{data.offer.name}</span>
            <span className="text-sm">
              <span className="font-bold">
                {t('amount', { amount: f.number(data.offer.price) })}
              </span>{' '}
              {data.offer.old_price !== null && (
                <del className="text-text-2">{f.number(data.offer.old_price)}</del>
              )}
            </span>
          </span>
          <a href={safeHref(data.offer.url)} className={buttonClass('outline')}>
            {t('packages.offer')}
          </a>
        </div>
      )}
    </SectionCard>
  );
}

/** Booked consultation sessions. */
export function ConsultationsCard({ data }: { data: ServicesData }) {
  const { t } = useTranslation('services');
  const f = useFormat();
  const { upcoming } = data.consultations;
  const { rows, pager } = usePaged(upcoming);
  return (
    <SectionCard
      id="consultations"
      title={t('consultations.title')}
      size="md"
      className="scroll-mt-28"
      end={
        <a href={SITE.consultation} className={buttonClass('primary')}>
          {t('consultations.book')}
        </a>
      }
    >
      {upcoming.length === 0 ? (
        data.consultations.total === 0 ? (
          <EmptyState title={t('consultations.emptyTitle')} icon="calendar">
            {t('consultations.noneYet')}
          </EmptyState>
        ) : (
          <EmptyState>{t('consultations.empty')}</EmptyState>
        )
      ) : (
        <ul className="m-0 list-none p-0 pb-2">
          {rows.map((item) => (
            <li key={item.id}>
              <Link
                to={`/consultations/${String(item.id)}`}
                className={`${ROW} text-text hover:bg-canvas`}
              >
                <span
                  aria-hidden="true"
                  className="flex size-12 flex-none flex-col items-center justify-center rounded-xl bg-tint text-primary-text"
                >
                  <span className="text-base leading-none font-bold">
                    {f.dayMonth(item.starts_at).day}
                  </span>
                  <span className="text-[11px]">{f.dayMonth(item.starts_at).month}</span>
                </span>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-[15px] font-semibold">{item.title}</span>
                  <span className="text-[13px] text-text-2">
                    {t('consultations.when', {
                      date: f.weekday(item.starts_at),
                      time: f.time(item.starts_at),
                    })}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {pager}
      {data.consultations.total > 0 && (
        <Link
          to="/consultations"
          className="px-5 pb-5 text-sm font-medium text-primary-text lg:px-7 lg:pb-6"
        >
          {t('consultations.all', { n: f.number(data.consultations.total) })}
        </Link>
      )}
    </SectionCard>
  );
}

/** Webinars and events the applicant registered for: join, watch, or read more. */
export function EventsCard({ data }: { data: ServicesData }) {
  const { t } = useTranslation('services');
  const f = useFormat();
  const { rows, pager } = usePaged(data.events);
  return (
    <SectionCard
      id="events"
      title={t('events.title')}
      size="md"
      className="scroll-mt-28"
      end={
        data.events.length > 0 && (
          <span className="text-sm text-text-2">
            {t('events.count', { n: f.number(data.events.length) })}
          </span>
        )
      }
    >
      {data.events.length === 0 ? (
        <EmptyState title={t('events.emptyTitle')} icon="calendar">
          {t('events.empty')}
        </EmptyState>
      ) : (
        <ul className="m-0 list-none p-0 pb-2">
          {rows.map((event) => {
            const action =
              event.status === 'upcoming' && event.join_url
                ? { href: event.join_url, label: t('events.join'), primary: true }
                : event.status === 'held' && event.video_url
                  ? { href: event.video_url, label: t('events.video'), primary: false }
                  : { href: null, label: t('events.details'), primary: false };
            const when =
              event.status === 'upcoming'
                ? [
                    t('events.upcoming', {
                      date: f.weekday(event.starts_at),
                      time: f.time(event.starts_at),
                    }),
                    event.online && t('events.online'),
                  ]
                : [
                    t('events.held', { date: f.dateShort(event.starts_at) }),
                    !event.video_url && t('events.videoSoon'),
                  ];
            return (
              <li key={event.id} className={`${ROW} flex-wrap justify-between`}>
                <span className="flex min-w-0 flex-[1_1_200px] flex-col gap-0.5">
                  <Link
                    to={`/services/events/${String(event.id)}`}
                    className="text-[15px] font-semibold text-text hover:text-primary-text"
                  >
                    {event.title}
                  </Link>
                  <span className="text-[13px] text-text-2">
                    {when.filter(Boolean).join(' · ')}
                  </span>
                </span>
                {action.href === null ? (
                  <Link
                    to={`/services/events/${String(event.id)}`}
                    className={buttonClass('outline', 'max-sm:w-full')}
                  >
                    {action.label}
                  </Link>
                ) : (
                  <a
                    href={safeHref(action.href)}
                    className={buttonClass(action.primary ? 'primary' : 'outline', 'max-sm:w-full')}
                  >
                    {action.label}
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {pager}
    </SectionCard>
  );
}
