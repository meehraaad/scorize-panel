import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { buttonClass } from '@/components/ui/buttonStyles';
import { Card } from '@/components/ui/Card';
import { Chip, type ChipTone } from '@/components/ui/Chip';
import { SelectField, TogglePill } from '@/components/ui/Choices';
import { EmptyState } from '@/components/ui/EmptyState';
import { FilterTabs } from '@/components/ui/Filters';
import { PageStack } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pager } from '@/components/ui/Pager';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { pagesOf, useClampPage } from '@/lib/api/page';
import { useFormat } from '@/lib/i18n/useFormat';
import { messageHref } from '@/lib/sales/api';
import { safeHref } from '@/lib/url';
import { consultationsQuery, type Consultation, type ConsultationRange } from './api';
import { customerPath } from './paths';

const RANGES: readonly ConsultationRange[] = ['today', 'week', 'past', 'all'];
const SOON_MINUTES = 30;

type Status = 'need' | 'done' | 'soon' | 'upcoming';
const STATUS_TONE: Record<Status, ChipTone> = {
  need: 'warn',
  done: 'good',
  soon: 'primary',
  upcoming: 'info',
};

const statusOf = (item: Consultation, now: number): Status => {
  const starts = new Date(item.starts_at).getTime();
  if (starts <= now) return item.logged ? 'done' : 'need';
  return starts - now <= SOON_MINUTES * 60_000 ? 'soon' : 'upcoming';
};

const dayKey = (value: string) => new Date(value).toDateString();

/** Consultations assigned to the seller, by day; past ones without a logged session stand out. */
export default function ConsultationsPage() {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const [range, setRange] = useState<ConsultationRange>('week');
  const [type, setType] = useState('all');
  const [unlogged, setUnlogged] = useState(false);
  const [page, setPage] = useState(1);
  const { data, isPlaceholderData } = useQuery(
    consultationsQuery(range, type === 'all' ? null : Number(type), unlogged, page),
  );
  const pages = pagesOf(data);
  useClampPage(data, page, setPage);

  // Read once: the statuses don't need to change while the page is open.
  const [now] = useState(() => Date.now());

  const days = new Map<string, Consultation[]>();
  for (const item of data?.results ?? []) {
    const key = dayKey(item.starts_at);
    days.set(key, [...(days.get(key) ?? []), item]);
  }

  return (
    <PageStack>
      <PageHeader
        title={t('consultations.title')}
        subtitle={
          data && data.unlogged > 0
            ? `${t('consultations.subtitle')} ${t('consultations.unlogged', { n: f.number(data.unlogged) })}`
            : t('consultations.subtitle')
        }
      />
      <div className="flex flex-wrap items-center gap-2.5">
        <FilterTabs
          label={t('consultations.range')}
          value={range}
          onChange={(value) => {
            setRange(value);
            setPage(1);
          }}
          options={RANGES.map((value) => ({
            value,
            label: t(`consultations.rangeOption.${value}`),
            ...(data ? { count: f.number(data.counts[value]) } : {}),
          }))}
        />
        <SelectField
          inline
          label={t('consultations.type')}
          value={type}
          onChange={(value) => {
            setType(value);
            setPage(1);
          }}
          options={[
            { value: 'all', label: t('consultations.allTypes') },
            ...(data?.types ?? []).map((item) => ({ value: String(item.id), label: item.name })),
          ]}
        />
        <TogglePill
          label={t('consultations.unloggedOnly')}
          checked={unlogged}
          onChange={(value) => {
            setUnlogged(value);
            setPage(1);
          }}
        />
      </div>

      {!data ? (
        <Card>
          <SkeletonRows rows={4} />
        </Card>
      ) : days.size === 0 ? (
        <EmptyState variant="card">{t('consultations.empty')}</EmptyState>
      ) : (
        [...days.values()].map((items) => {
          const first = items[0]?.starts_at ?? '';
          const id = `day-${dayKey(first).replace(/\s/g, '-')}`;
          return (
            <Card key={id} aria-labelledby={id}>
              <div className="flex items-baseline justify-between gap-3 px-5 pt-5 pb-2 lg:px-8 lg:pt-6">
                <h2 id={id} className="m-0 font-display text-lg font-bold">
                  {f.weekday(first)}
                </h2>
                <span className="text-sm text-text-2">
                  {t('consultations.count', { n: f.number(items.length) })}
                </span>
              </div>
              <ul className="m-0 list-none p-0">
                {items.map((item) => (
                  <ConsultationRow key={item.id} item={item} status={statusOf(item, now)} />
                ))}
              </ul>
            </Card>
          );
        })
      )}
      {pages > 1 && (
        <Card>
          <Pager page={page} pages={pages} pending={isPlaceholderData} onPage={setPage} />
        </Card>
      )}
    </PageStack>
  );
}

function ConsultationRow({ item, status }: { item: Consultation; status: Status }) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const action = (label: string) =>
    t('consultations.actionsFor', { action: label, name: item.name });
  const reminder = t('consultations.remindText', {
    name: item.name,
    type: item.type.name,
    when: `${f.weekday(item.starts_at)} ${f.time(item.starts_at)}`,
  });
  return (
    <li
      className={`flex flex-wrap items-center gap-x-5 gap-y-3 px-5 py-4 shadow-[inset_0_1px_0_var(--hair)] lg:flex-nowrap lg:px-8 ${status === 'need' ? 'bg-row-highlight' : ''}`}
    >
      <span
        className={`w-14 flex-none text-lg font-bold tabular-nums ${status === 'need' ? 'text-urgent' : 'text-text'}`}
      >
        {f.time(item.starts_at)}
      </span>
      <span className="flex min-w-0 flex-[1_1_240px] flex-col gap-1">
        <Link
          to={customerPath(item.customer)}
          className="text-base font-semibold text-text hover:underline"
        >
          {item.name}
        </Link>
        <span className="text-sm text-text-2">
          {item.minutes === null
            ? t('consultations.metaShort', { type: item.type.name, mode: t(`mode.${item.mode}`) })
            : t('consultations.meta', {
                type: item.type.name,
                mode: t(`mode.${item.mode}`),
                minutes: f.number(item.minutes),
              })}
        </span>
      </span>
      <Chip tone={STATUS_TONE[status]} small>
        {t(`consultations.status.${status}`)}
      </Chip>
      <span className="flex flex-wrap gap-2">
        {(status === 'need' || status === 'soon') && (
          <Link
            to={customerPath(item.customer, 'meeting', item.id)}
            aria-label={action(t('consultations.log'))}
            className={buttonClass('primary', 'h-11 px-4 text-sm')}
          >
            {t('consultations.log')}
          </Link>
        )}
        {status === 'upcoming' && (
          <a
            href={messageHref('whatsapp', item.phone, reminder)}
            target="_blank"
            rel="noreferrer"
            aria-label={action(t('consultations.remind'))}
            className={buttonClass('outline', 'h-11 px-4 text-sm')}
          >
            {t('consultations.remind')}
          </a>
        )}
        {item.meeting_url && (
          <a
            href={safeHref(item.meeting_url)}
            target="_blank"
            rel="noreferrer"
            aria-label={action(t('consultations.link'))}
            className={buttonClass('outline', 'h-11 px-4 text-sm')}
          >
            {t('consultations.link')}
          </a>
        )}
        <Link
          to={customerPath(item.customer)}
          aria-label={action(t('consultations.customer'))}
          className={buttonClass('outline', 'h-11 px-4 text-sm')}
        >
          {t('consultations.customer')}
        </Link>
      </span>
    </li>
  );
}
