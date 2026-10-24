import { useSuspenseQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';
import { BackLink } from '@/components/ui/BackLink';
import { buttonClass } from '@/components/ui/buttonStyles';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { PageColumns, PageStack } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { daysUntil, isPast } from '@/lib/dates';
import { useFormat } from '@/lib/i18n/useFormat';
import { safeHref } from '@/lib/url';
import { eventQuery, type EventDetail } from './api';
import { NotFound } from './components/NotFound';

/**
 * An event or webinar the user registered for: how to join (the button turns on when the room
 * opens), what it's about, its recording, and the registration invoice. Design: canvas V6
 * section 13 (AppDetail, event).
 */
export default function EventPage() {
  const id = Number(useParams().id);
  if (!Number.isInteger(id) || id <= 0) return <NotFound />;
  return <Event id={id} key={id} />;
}

function Event({ id }: { id: number }) {
  const { t } = useTranslation('services');
  const { data } = useSuspenseQuery(eventQuery(id));
  if (!data) return <NotFound />;
  const kind = t(`event.kind.${data.kind}`);

  return (
    <PageStack>
      <BackLink to="/services">{t('detail.back')}</BackLink>
      <PageHeader
        title={data.title}
        subtitle={
          data.registered ? (
            <Chip tone="good" dot>
              {`${kind} · ${t('event.registered')}`}
            </Chip>
          ) : (
            <Chip tone="neutral">{kind}</Chip>
          )
        }
      />
      <PageColumns
        asideLabel={t('event.invoice')}
        main={
          <>
            <JoinCard event={data} kind={kind} />
            <SectionCard variant="panel" id="event-about" title={t('event.about', { kind })}>
              <p className="m-0 text-[15px] leading-8 whitespace-pre-line text-text-2">
                {data.description}
              </p>
            </SectionCard>
            <SectionCard variant="panel" id="event-video" title={t('event.video', { kind })}>
              <p className="m-0 text-sm leading-7 text-text-2">
                {isPast(data.starts_at) && !data.video_url
                  ? t('event.videoSoon')
                  : t('event.videoText')}
              </p>
              {data.video_url ? (
                <a href={safeHref(data.video_url)} className={buttonClass('outline', 'self-start')}>
                  {t('event.download')}
                </a>
              ) : (
                <Button variant="outline" disabled className="self-start">
                  {t('event.downloadLater')}
                </Button>
              )}
            </SectionCard>
          </>
        }
        aside={data.invoice && <Invoice event={data} invoice={data.invoice} />}
      />
    </PageStack>
  );
}

function JoinCard({ event, kind }: { event: EventDetail; kind: string }) {
  const { t } = useTranslation('services');
  const f = useFormat();
  const held = isPast(event.starts_at) && !event.join_url;
  const days = daysUntil(event.starts_at);
  return (
    <section
      aria-labelledby="event-join"
      className="flex flex-col gap-2.5 rounded-[24px] bg-hero px-5 py-[22px] text-on-hero shadow-hero lg:rounded-[28px] lg:px-8 lg:py-7"
    >
      <span id="event-join" className="text-[13px] font-semibold text-hero-current">
        {t('event.how', { kind })}
      </span>
      <span className="font-display text-[22px] font-bold lg:text-[26px]">
        {t('event.when', { date: f.weekday(event.starts_at), time: f.time(event.starts_at) })}
      </span>
      <span className="text-sm leading-7 text-on-hero-2">
        {held ? t('event.heldText') : (event.location ?? t('event.howText'))}
      </span>
      {!held &&
        (event.join_url ? (
          <a href={safeHref(event.join_url)} className={buttonClass('primary', 'mt-1 self-start')}>
            {t('event.join', { kind })}
          </a>
        ) : (
          <Button disabled className="mt-1 self-start">
            {t('event.joinIn', { kind, days: f.relativeDays(days) })}
          </Button>
        ))}
    </section>
  );
}

function Invoice({
  event,
  invoice,
}: {
  event: EventDetail;
  invoice: NonNullable<EventDetail['invoice']>;
}) {
  const { t } = useTranslation('services');
  const f = useFormat();
  const rows: [string, string][] = [
    [t('event.invTitle'), event.title],
    [t('event.invPlace'), event.online ? t('event.online') : (event.location ?? '')],
    [t('event.invDate'), `${f.weekday(event.starts_at)} · ${f.time(event.starts_at)}`],
    [
      t('event.invAmount'),
      invoice.amount > 0 ? t('amount', { amount: f.number(invoice.amount) }) : t('event.free'),
    ],
  ];
  return (
    <SectionCard variant="panel" id="event-invoice" title={t('event.invoice')}>
      <dl className="m-0 flex flex-col">
        {rows.map(([label, value], index) => (
          <div
            key={label}
            className={`flex justify-between gap-3 py-3 text-sm ${
              index > 0 ? 'shadow-[inset_0_1px_0_var(--hair)]' : ''
            }`}
          >
            <dt className="text-text-2">{label}</dt>
            <dd className="m-0 text-end font-medium">{value}</dd>
          </div>
        ))}
      </dl>
    </SectionCard>
  );
}
