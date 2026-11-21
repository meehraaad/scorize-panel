import { useSuspenseQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import { PageStack } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/SectionCard';
import { useFormat } from '@/lib/i18n/useFormat';
import { openCaseChat } from '@/lib/supervisor/caseChats';
import { myServicesQuery, serviceTitle } from './api';
import { casePath } from './paths';

/**
 * The services the viewer owns (SVC4): what a visa expert works from. Unread conversations first;
 * a row opens that service's conversation in the chat window, the folder opens the case.
 */
export default function MyServicesPage() {
  const { t } = useTranslation('supervisor');
  const f = useFormat();
  const { data } = useSuspenseQuery(myServicesQuery);
  const waiting = data.results.filter((item) => item.unread > 0).length;

  return (
    <PageStack>
      <PageHeader
        title={t('myServices.title')}
        subtitle={
          data.count
            ? t('myServices.subtitle', { n: f.number(data.count), waiting: f.number(waiting) })
            : undefined
        }
      />
      <Card aria-label={t('myServices.list')}>
        {data.results.length === 0 ? (
          <EmptyState variant="padded">{t('myServices.empty')}</EmptyState>
        ) : (
          <ul className="m-0 list-none p-0">
            {data.results.map((item) => (
              <li
                key={item.id}
                className={`flex items-stretch not-first:shadow-[inset_0_1px_0_var(--hair)] ${
                  item.unread > 0 ? 'bg-row-highlight' : ''
                }`}
              >
                <button
                  type="button"
                  onClick={() =>
                    openCaseChat(item.case, item.case_name, `service/${String(item.id)}`)
                  }
                  className="flex min-w-0 flex-1 items-start gap-3 py-4 ps-5 pe-2 text-start text-text hover:bg-canvas lg:ps-8"
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-base font-semibold">{item.case_name}</span>
                      <span className="text-sm text-text-2">{serviceTitle(item)}</span>
                    </span>
                    <span className="flex flex-wrap items-center gap-2">
                      {item.stage && (
                        <Chip tone={item.stage.final ? 'good' : 'info'} small>
                          {item.stage.name}
                        </Chip>
                      )}
                      {item.status === 'paused' && (
                        <Chip tone="neutral" small>
                          {t('services.paused')}
                        </Chip>
                      )}
                    </span>
                  </span>
                  <span className="flex flex-none flex-col items-end gap-1.5">
                    {item.last_message_at && (
                      <time dateTime={item.last_message_at} className="text-[13px] text-text-2">
                        {f.timeAgo(item.last_message_at)}
                      </time>
                    )}
                    {item.unread > 0 && (
                      <>
                        <Badge>{f.number(item.unread)}</Badge>
                        <span className="sr-only">{t('inbox.unread')}</span>
                      </>
                    )}
                  </span>
                </button>
                <Link
                  to={casePath(item.case)}
                  aria-label={t('inbox.openCase', { name: item.case_name })}
                  title={t('inbox.openCase', { name: item.case_name })}
                  className="flex w-14 flex-none items-center justify-center text-text-2 hover:bg-canvas hover:text-text lg:w-16"
                >
                  <Icon name="folder" size={20} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </PageStack>
  );
}
