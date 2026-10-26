import { useSuspenseQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { Icon, type IconName } from '@/components/ui/Icon';
import { LinkTile, TileGrid } from '@/components/ui/LinkTile';
import { PageStack } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import { ON_SERVER } from '@/lib/applicant/onServer';
import { useFormat } from '@/lib/i18n/useFormat';
import { servicesQuery } from './api';
import { GpaCard } from './components/GpaCard';
import { ConsultationsCard, EventsCard, PackagesCard } from './components/ServiceCards';
import { WebinarCard } from './components/WebinarCard';

/** Consultations have their own page; the other tiles jump to sections of this one. */
const linkTo = (id: string) =>
  id === 'consultations' ? { to: '/consultations' } : { href: `#${id}` };

/**
 * "Learning & packages" (was "Other services"): the applicant's videos and packages first. Design: canvas V6 section 9 (AppServices). Open with or without a contract.
 */
export default function ServicesPage() {
  const { t } = useTranslation('services');
  const f = useFormat();
  const { data } = useSuspenseQuery(servicesQuery);
  const upcomingEvents = data.events.filter((event) => event.status === 'upcoming').length;
  const booked = data.consultations.upcoming.length;

  const tiles: { id: string; icon: IconName; title: string; text: string }[] = [
    {
      id: 'packages',
      icon: 'play',
      title: t('tile.packages.title'),
      text: data.packages.length
        ? t('tile.packages.count', { n: f.number(data.packages.length) })
        : t('tile.packages.none'),
    },
    {
      id: 'events',
      icon: 'calendar',
      title: t('tile.events.title'),
      text: upcomingEvents
        ? t('tile.events.count', { n: f.number(upcomingEvents) })
        : t('tile.events.none'),
    },
    {
      id: 'consultations',
      icon: 'chat',
      title: t('tile.consultations.title'),
      text: booked
        ? t('tile.consultations.count', { n: f.number(booked) })
        : t('tile.consultations.none'),
    },
    {
      id: 'gpa',
      icon: 'chart',
      title: t('tile.gpa.title'),
      text:
        data.gpa.result === null
          ? t('tile.gpa.none')
          : t('tile.gpa.result', { gpa: f.number(data.gpa.result) }),
    },
  ];

  return (
    <PageStack>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          <Card className="flex flex-col gap-0.5 px-5 py-3 max-sm:w-full">
            <span className="text-[13px] text-text-2">{t('credit')}</span>
            <span className="text-lg font-bold tabular-nums">
              {t('amount', { amount: f.number(data.credit) })}
            </span>
          </Card>
        }
      />

      <nav aria-label={t('sections')}>
        <TileGrid dense>
          {tiles
            .filter((tile) => tile.id !== 'gpa' || ON_SERVER.gpaSave)
            .map((tile) => (
              <LinkTile
                key={tile.id}
                {...linkTo(tile.id)}
                title={tile.title}
                text={tile.text}
                end={
                  <span
                    aria-hidden="true"
                    className="flex size-10 flex-none items-center justify-center rounded-xl bg-tint text-primary-text"
                  >
                    <Icon name={tile.icon} size={20} />
                  </span>
                }
              />
            ))}
        </TileGrid>
      </nav>

      {data.webinar && ON_SERVER.webinarRegistration && <WebinarCard webinar={data.webinar} />}

      <div className="grid items-start gap-4 lg:grid-cols-2 lg:gap-7">
        <PackagesCard data={data} />
        <ConsultationsCard data={data} />
        <EventsCard data={data} />
        {ON_SERVER.gpaSave && <GpaCard data={data} />}
      </div>
    </PageStack>
  );
}
